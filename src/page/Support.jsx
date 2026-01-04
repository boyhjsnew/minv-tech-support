import React, { useEffect, useState, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";

const Support = () => {
  const [os, setOs] = useState("macos");
  const [extractedImages, setExtractedImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.title = "Hỗ trợ kỹ thuật";

    // Detect OS
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) {
      setOs("windows");
    } else if (userAgent.includes("mac")) {
      setOs("macos");
    } else {
      setOs("linux");
    }
  }, []);

  const getChromeCommand = () => {
    if (os === "windows") {
      return `start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --new-window --user-data-dir="%TEMP%\\chrome_dev_test" --disable-web-security`;
    } else if (os === "macos") {
      return `open -n -a /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security`;
    } else {
      return `google-chrome --new-window --user-data-dir="/tmp/chrome_dev_test" --disable-web-security`;
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Đã copy vào clipboard!");
  };

  // Hàm parse file .repx và extract hình ảnh
  const extractImagesFromRepx = async (file) => {
    return new Promise((resolve, reject) => {
      // Đầu tiên, kiểm tra xem file có phải là ZIP không
      const zipReader = new FileReader();
      zipReader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);

        // Kiểm tra magic bytes của ZIP (PK\x03\x04 hoặc PK\x05\x06)
        const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4b;

        if (isZip) {
          console.log("File .repx là ZIP archive");
          // File là ZIP, cần extract và tìm hình ảnh trong các file XML bên trong
          // Tạm thời thử đọc như text để tìm base64 trong toàn bộ file
          const textReader = new FileReader();
          textReader.onload = (textEvent) => {
            try {
              const content = textEvent.target.result;
              const images = extractImagesFromContent(content, "zip");
              resolve(images);
            } catch (error) {
              reject(new Error(`Lỗi khi parse ZIP: ${error.message}`));
            }
          };
          textReader.onerror = () => reject(new Error("Lỗi khi đọc file ZIP"));
          textReader.readAsText(file);
        } else {
          // File là XML thuần
          console.log("File .repx là XML");
          const textReader = new FileReader();
          textReader.onload = (textEvent) => {
            try {
              const content = textEvent.target.result;
              const images = extractImagesFromContent(content, "xml");
              resolve(images);
            } catch (error) {
              reject(new Error(`Lỗi khi parse XML: ${error.message}`));
            }
          };
          textReader.onerror = () => reject(new Error("Lỗi khi đọc file"));
          textReader.readAsText(file);
        }
      };
      zipReader.onerror = () => reject(new Error("Lỗi khi đọc file"));
      zipReader.readAsArrayBuffer(file.slice(0, 4)); // Chỉ đọc 4 bytes đầu để check
    });
  };

  // Hàm detect loại hình ảnh từ base64 string bằng magic bytes base64
  const detectImageTypeFromBase64 = (base64String) => {
    const cleanBase64 = base64String.replace(/\s/g, "").substring(0, 20); // Lấy 20 ký tự đầu để check

    // Magic bytes base64:
    // PNG: iVBORw0KGgo (base64 của PNG signature)
    // JPEG: /9j/ (base64 của 0xFF 0xD8 0xFF)
    // GIF: R0lGODlh hoặc R0lG (base64 của GIF signature)
    // BMP: Qk0 (base64 của 0x42 0x4D)

    if (cleanBase64.startsWith("iVBOR")) {
      return "png";
    } else if (
      cleanBase64.startsWith("/9j/") ||
      cleanBase64.startsWith("/9j/4")
    ) {
      return "jpeg";
    } else if (
      cleanBase64.startsWith("R0lGODlh") ||
      cleanBase64.startsWith("R0lG")
    ) {
      return "gif";
    } else if (cleanBase64.startsWith("Qk0")) {
      return "bmp";
    }

    // Fallback: decode và check binary magic bytes
    try {
      const binaryString = atob(cleanBase64.substring(0, 10));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        return "png";
      } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        return "jpeg";
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
        return "gif";
      } else if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return "bmp";
      }
    } catch (err) {
      // Không thể decode
    }

    return null;
  };

  // Hàm extract hình ảnh bitmap từ file .repx (DevExpress Report)
  const extractImagesFromContent = (content, fileType) => {
    const images = [];
    let imageIndex = 0;

    console.log(
      `Đang tìm hình ảnh bitmap trong ${fileType}, độ dài content: ${content.length}`
    );

    // DevExpress Report thường lưu bitmap trong các tag XRPictureBox, Image, hoặc Resources
    // Pattern 1: Tìm trong XRPictureBox với ImageData hoặc Base64Value
    try {
      const xmlDoc = new DOMParser().parseFromString(content, "text/xml");
      const parserError = xmlDoc.querySelector("parsererror");
      if (!parserError) {
        // Tìm tất cả các element có thể chứa bitmap
        const pictureElements = xmlDoc.querySelectorAll(
          "XRPictureBox, XRPictureBoxControl, Image, Picture, *[ImageData], *[Base64Value], *[ImageUrl]"
        );

        console.log(
          `Tìm thấy ${pictureElements.length} elements có thể chứa bitmap`
        );

        pictureElements.forEach((element, index) => {
          // Tìm ImageData attribute (thường là base64 của bitmap)
          const imageData = element.getAttribute("ImageData");
          if (imageData && imageData.length > 100) {
            // Có thể là base64 thuần hoặc có prefix
            let base64Data = imageData;
            let imageType = "png"; // Mặc định PNG cho bitmap

            // Kiểm tra xem có prefix data:image không
            if (imageData.startsWith("data:image")) {
              const match = imageData.match(/data:image\/([^;]+);base64,(.+)/i);
              if (match) {
                imageType = match[1].toLowerCase();
                base64Data = match[2];
              }
            } else {
              // Base64 thuần, detect từ magic bytes base64 (nhanh hơn)
              const detectedType = detectImageTypeFromBase64(base64Data);
              if (detectedType) {
                imageType = detectedType;
              } else {
                // Fallback: decode và check binary magic bytes
                try {
                  const binaryString = atob(base64Data.replace(/\s/g, ""));
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  // Xác định loại từ magic bytes
                  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
                    imageType = "png";
                  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
                    imageType = "jpeg";
                  } else if (bytes[0] === 0x47 && bytes[1] === 0x49) {
                    imageType = "gif";
                  } else if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
                    imageType = "bmp"; // Bitmap
                  }
                } catch (err) {
                  console.warn("Không thể validate base64:", err);
                }
              }
            }

            const cleanBase64 = base64Data.replace(/\s/g, "");
            if (cleanBase64.length > 100) {
              const imageDataUri = imageData.startsWith("data:image")
                ? imageData
                : `data:image/${imageType};base64,${cleanBase64}`;
              images.push({
                id: `img_bitmap_${imageIndex++}`,
                name: `bitmap_${imageIndex}.${imageType}`,
                data: imageDataUri,
                type: imageType,
              });
              console.log(`Tìm thấy bitmap trong ImageData: ${imageType}`);
            }
          }

          // Tìm Base64Value attribute
          const base64Value = element.getAttribute("Base64Value");
          if (base64Value && base64Value.length > 100 && !imageData) {
            // Chưa có trong ImageData, thử Base64Value
            let base64Data = base64Value.replace(/\s/g, "");
            let imageType = "png";

            if (!base64Value.startsWith("data:image")) {
              // Detect từ magic bytes base64 (nhanh hơn)
              const detectedType = detectImageTypeFromBase64(base64Data);
              if (detectedType) {
                imageType = detectedType;
              } else {
                // Fallback: decode và check binary magic bytes
                try {
                  const binaryString = atob(base64Data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
                    imageType = "png";
                  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
                    imageType = "jpeg";
                  } else if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
                    imageType = "bmp";
                  }
                } catch (err) {
                  // Không phải base64 hợp lệ
                }
              }
            } else {
              const match = base64Value.match(
                /data:image\/([^;]+);base64,(.+)/i
              );
              if (match) {
                imageType = match[1].toLowerCase();
                base64Data = match[2].replace(/\s/g, "");
              }
            }

            const imageDataUri = base64Value.startsWith("data:image")
              ? base64Value
              : `data:image/${imageType};base64,${base64Data}`;
            images.push({
              id: `img_base64_${imageIndex++}`,
              name: `bitmap_${imageIndex}.${imageType}`,
              data: imageDataUri,
              type: imageType,
            });
            console.log(`Tìm thấy bitmap trong Base64Value: ${imageType}`);
          }

          // Tìm trong text content (có thể là base64 thuần)
          const textContent = element.textContent?.trim();
          if (
            textContent &&
            textContent.length > 500 &&
            /^[A-Za-z0-9+/=\s]+$/.test(textContent)
          ) {
            // Có thể là base64 bitmap lớn
            const base64Clean = textContent.replace(/\s/g, "");
            // Detect từ magic bytes base64 (nhanh hơn, không cần decode)
            const detectedType = detectImageTypeFromBase64(base64Clean);
            if (detectedType) {
              const imageDataUri = `data:image/${detectedType};base64,${base64Clean}`;
              images.push({
                id: `img_text_${imageIndex++}`,
                name: `bitmap_${imageIndex}.${detectedType}`,
                data: imageDataUri,
                type: detectedType,
              });
              console.log(
                `Tìm thấy bitmap trong text content: ${detectedType}`
              );
            } else {
              // Fallback: decode và check binary magic bytes
              try {
                const binaryString = atob(base64Clean);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < Math.min(binaryString.length, 10); i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                // Kiểm tra magic bytes
                if (
                  (bytes[0] === 0x89 && bytes[1] === 0x50) ||
                  (bytes[0] === 0xff && bytes[1] === 0xd8) ||
                  (bytes[0] === 0x42 && bytes[1] === 0x4d) ||
                  (bytes[0] === 0x47 && bytes[1] === 0x49)
                ) {
                  const imageType =
                    bytes[0] === 0x89
                      ? "png"
                      : bytes[0] === 0xff
                      ? "jpeg"
                      : bytes[0] === 0x42
                      ? "bmp"
                      : "gif";
                  const imageDataUri = `data:image/${imageType};base64,${base64Clean}`;
                  images.push({
                    id: `img_text_${imageIndex++}`,
                    name: `bitmap_${imageIndex}.${imageType}`,
                    data: imageDataUri,
                    type: imageType,
                  });
                  console.log(
                    `Tìm thấy bitmap trong text content: ${imageType}`
                  );
                }
              } catch (err) {
                // Không phải base64 hợp lệ
              }
            }
          }
        });
      }
    } catch (xmlError) {
      console.warn("Không thể parse XML:", xmlError);
    }

    // Pattern 2: Tìm base64 images với data:image prefix (fallback)
    const base64Pattern1 =
      /data:image\/([^;]+);base64,([A-Za-z0-9+/=\s]{500,})/gi;
    let match;
    while ((match = base64Pattern1.exec(content)) !== null) {
      const imageType = match[1].toLowerCase();
      const base64Data = match[2].replace(/\s/g, "");
      // Chỉ lấy base64 lớn (bitmap thường lớn hơn 500 chars)
      if (base64Data.length > 500) {
        const imageData = `data:image/${imageType};base64,${base64Data}`;
        images.push({
          id: `img_base64_${imageIndex++}`,
          name: `bitmap_${imageIndex}.${imageType}`,
          data: imageData,
          type: imageType,
        });
        console.log(
          `Tìm thấy hình ảnh base64: ${imageType}, độ dài: ${base64Data.length}`
        );
      }
    }

    // Pattern 3: Tìm base64 không có data: prefix (chỉ là chuỗi base64 thuần)
    // Base64 hợp lệ thường có độ dài lớn và kết thúc bằng = hoặc ==
    const base64OnlyPattern = /([A-Za-z0-9+/]{100,}={0,2})/g;
    let base64Match;
    while ((base64Match = base64OnlyPattern.exec(content)) !== null) {
      const potentialBase64 = base64Match[1];
      // Detect từ magic bytes base64 (nhanh hơn, không cần decode)
      const detectedType = detectImageTypeFromBase64(potentialBase64);
      if (detectedType) {
        const imageData = `data:image/${detectedType};base64,${potentialBase64}`;
        images.push({
          id: `img_raw_${imageIndex++}`,
          name: `bitmap_${imageIndex}.${detectedType}`,
          data: imageData,
          type: detectedType,
        });
        console.log(`Tìm thấy hình ảnh raw base64: ${detectedType}`);
      } else {
        // Fallback: decode và check binary magic bytes
        try {
          const binaryString = atob(potentialBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < Math.min(binaryString.length, 10); i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // Kiểm tra magic bytes của PNG, JPEG, GIF, BMP
          if (
            (bytes[0] === 0x89 && bytes[1] === 0x50) || // PNG
            (bytes[0] === 0xff && bytes[1] === 0xd8) || // JPEG
            (bytes[0] === 0x47 && bytes[1] === 0x49) || // GIF
            (bytes[0] === 0x42 && bytes[1] === 0x4d) // BMP
          ) {
            const imageType =
              bytes[0] === 0x89
                ? "png"
                : bytes[0] === 0xff
                ? "jpeg"
                : bytes[0] === 0x42
                ? "bmp"
                : "gif";
            const imageData = `data:image/${imageType};base64,${potentialBase64}`;
            images.push({
              id: `img_raw_${imageIndex++}`,
              name: `bitmap_${imageIndex}.${imageType}`,
              data: imageData,
              type: imageType,
            });
            console.log(`Tìm thấy hình ảnh raw base64: ${imageType}`);
          }
        } catch (err) {
          // Không phải base64 hợp lệ, bỏ qua
        }
      }
    }

    // Pattern 3: Tìm trong các tag XML
    try {
      const xmlDoc = new DOMParser().parseFromString(content, "text/xml");
      const parserError = xmlDoc.querySelector("parsererror");
      if (!parserError) {
        // Tìm tất cả các element có thể chứa hình ảnh
        const imageElements = xmlDoc.querySelectorAll(
          "Image, Picture, XRPictureBox, XRPictureBoxControl, XRRichText, *[Base64Value], *[Image], *[ImageUrl]"
        );

        imageElements.forEach((element, index) => {
          // Tìm trong attributes
          Array.from(element.attributes).forEach((attr) => {
            const value = attr.value;
            if (value && value.includes("base64")) {
              const match = value.match(
                /data:image\/([^;]+);base64,([A-Za-z0-9+/=\s]+)/i
              );
              if (match) {
                const imageType = match[1].toLowerCase();
                const base64Data = match[2].replace(/\s/g, "");
                if (base64Data.length > 100) {
                  const imageData = `data:image/${imageType};base64,${base64Data}`;
                  images.push({
                    id: `img_attr_${imageIndex++}`,
                    name: `image_attr_${imageIndex}.${imageType}`,
                    data: imageData,
                    type: imageType,
                  });
                }
              }
            }
          });

          // Tìm trong text content
          const textContent = element.textContent?.trim();
          if (textContent) {
            // Tìm base64 trong text
            const textMatch = textContent.match(
              /data:image\/([^;]+);base64,([A-Za-z0-9+/=\s]+)/i
            );
            if (textMatch) {
              const imageType = textMatch[1].toLowerCase();
              const base64Data = textMatch[2].replace(/\s/g, "");
              if (base64Data.length > 100) {
                const imageData = `data:image/${imageType};base64,${base64Data}`;
                images.push({
                  id: `img_text_${imageIndex++}`,
                  name: `image_text_${imageIndex}.${imageType}`,
                  data: imageData,
                  type: imageType,
                });
              }
            } else if (
              textContent.length > 100 &&
              /^[A-Za-z0-9+/=\s]+$/.test(textContent)
            ) {
              // Có thể là base64 thuần
              const base64Clean = textContent.replace(/\s/g, "");
              // Detect từ magic bytes base64 (nhanh hơn)
              const detectedType = detectImageTypeFromBase64(base64Clean);
              if (detectedType) {
                const imageData = `data:image/${detectedType};base64,${base64Clean}`;
                images.push({
                  id: `img_xml_text_${imageIndex++}`,
                  name: `bitmap_${imageIndex}.${detectedType}`,
                  data: imageData,
                  type: detectedType,
                });
                console.log(`Tìm thấy bitmap trong XML text: ${detectedType}`);
              } else {
                // Fallback: decode và check binary magic bytes
                try {
                  const binaryString = atob(base64Clean);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < Math.min(binaryString.length, 10); i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  if (
                    (bytes[0] === 0x89 && bytes[1] === 0x50) ||
                    (bytes[0] === 0xff && bytes[1] === 0xd8) ||
                    (bytes[0] === 0x47 && bytes[1] === 0x49) ||
                    (bytes[0] === 0x42 && bytes[1] === 0x4d)
                  ) {
                    const imageType =
                      bytes[0] === 0x89
                        ? "png"
                        : bytes[0] === 0xff
                        ? "jpeg"
                        : bytes[0] === 0x42
                        ? "bmp"
                        : "gif";
                    const imageData = `data:image/${imageType};base64,${base64Clean}`;
                    images.push({
                      id: `img_xml_text_${imageIndex++}`,
                      name: `bitmap_${imageIndex}.${imageType}`,
                      data: imageData,
                      type: imageType,
                    });
                    console.log(`Tìm thấy bitmap trong XML text: ${imageType}`);
                  }
                } catch (err) {
                  // Không phải base64
                }
              }
            }
          }
        });
      }
    } catch (xmlError) {
      console.warn("Không thể parse XML:", xmlError);
    }

    // Pattern 4: Tìm trong CDATA sections
    const cdataPattern = /<!\[CDATA\[(.*?)\]\]>/gs;
    let cdataMatch;
    while ((cdataMatch = cdataPattern.exec(content)) !== null) {
      const cdataContent = cdataMatch[1];
      const cdataBase64Match = cdataContent.match(
        /data:image\/([^;]+);base64,([A-Za-z0-9+/=\s]+)/i
      );
      if (cdataBase64Match) {
        const imageType = cdataBase64Match[1].toLowerCase();
        const base64Data = cdataBase64Match[2].replace(/\s/g, "");
        if (base64Data.length > 100) {
          const imageData = `data:image/${imageType};base64,${base64Data}`;
          images.push({
            id: `img_cdata_${imageIndex++}`,
            name: `image_cdata_${imageIndex}.${imageType}`,
            data: imageData,
            type: imageType,
          });
        }
      }
    }

    // Loại bỏ duplicate dựa trên data
    const uniqueImages = [];
    const seenData = new Set();
    images.forEach((img) => {
      // Normalize data để so sánh (loại bỏ whitespace)
      const normalizedData = img.data.replace(/\s/g, "");
      if (!seenData.has(normalizedData)) {
        seenData.add(normalizedData);
        uniqueImages.push(img);
      }
    });

    console.log(`Tổng cộng tìm thấy ${uniqueImages.length} hình ảnh unique`);
    return uniqueImages;
  };

  // Xử lý khi upload file
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".repx")) {
      toast.error(
        <ToastNotify status={-1} message="Vui lòng chọn file .repx" />,
        { style: styleError }
      );
      return;
    }

    setProcessing(true);
    setExtractedImages([]);

    try {
      const images = await extractImagesFromRepx(file);

      if (images.length === 0) {
        toast.warning(
          <ToastNotify
            status={-1}
            message="Không tìm thấy hình ảnh trong file .repx"
          />,
          { style: styleError }
        );
      } else {
        setExtractedImages(images);
        toast.success(
          <ToastNotify
            status={0}
            message={`Đã tìm thấy ${images.length} hình ảnh`}
          />,
          { style: styleSuccess }
        );
      }
    } catch (error) {
      console.error("Error extracting images:", error);
      toast.error(
        <ToastNotify status={-1} message={`Lỗi: ${error.message}`} />,
        { style: styleError }
      );
    } finally {
      setProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Download một hình ảnh
  const downloadImage = (image) => {
    const link = document.createElement("a");
    link.href = image.data;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download tất cả hình ảnh
  const downloadAllImages = () => {
    extractedImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImage(image);
      }, index * 200); // Delay để tránh browser block
    });
  };

  return (
    <div
      style={{
        paddingTop: "7rem",
        backgroundColor: "#EDF1F5",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <ToastContainer
        autoClose={2000}
        hideProgressBar
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <div className="gird-layout wide">
        <div className="row">
          <div className="col l-12">
            {/* Tool bóc tách hình ảnh từ file .repx */}
            <div
              className="card"
              style={{
                backgroundColor: "white",
                padding: "2rem",
                marginBottom: "2rem",
              }}
            >
              <h2 style={{ color: "#0069b4", marginBottom: "1.5rem" }}>
                Tool bóc tách hình ảnh từ file .repx
              </h2>

              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  htmlFor="repx-upload"
                  style={{
                    display: "inline-block",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#0069b4",
                    color: "white",
                    borderRadius: "4px",
                    cursor: processing ? "not-allowed" : "pointer",
                    fontWeight: 500,
                    opacity: processing ? 0.6 : 1,
                  }}
                >
                  {processing ? "Đang xử lý..." : "Chọn file .repx"}
                </label>
                <input
                  ref={fileInputRef}
                  id="repx-upload"
                  type="file"
                  accept=".repx"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                  disabled={processing}
                />
                <p
                  style={{
                    color: "#666",
                    fontSize: "14px",
                    marginTop: "0.5rem",
                  }}
                >
                  Chọn file .repx để bóc tách hình ảnh. Hệ thống sẽ tự động tìm
                  và extract tất cả hình ảnh có trong file.
                </p>
              </div>

              {extractedImages.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <h3 style={{ color: "#333", margin: 0 }}>
                      Đã tìm thấy {extractedImages.length} hình ảnh
                    </h3>
                    <button
                      onClick={downloadAllImages}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      <i
                        className="fa-solid fa-download"
                        style={{ marginRight: "0.5rem" }}
                      ></i>
                      Tải tất cả
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    {extractedImages.map((image) => (
                      <div
                        key={image.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                        }}
                      >
                        <img
                          src={image.data}
                          alt={image.name}
                          style={{
                            width: "100%",
                            height: "150px",
                            objectFit: "contain",
                            backgroundColor: "white",
                            borderRadius: "4px",
                            marginBottom: "0.5rem",
                          }}
                        />
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            margin: "0 0 0.5rem 0",
                            wordBreak: "break-word",
                          }}
                        >
                          {image.name}
                        </p>
                        <button
                          onClick={() => downloadImage(image)}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            backgroundColor: "#0069b4",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <i
                            className="fa-solid fa-download"
                            style={{ marginRight: "0.25rem" }}
                          ></i>
                          Tải xuống
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Hướng dẫn Chrome Dev Mode */}
            <div
              className="card"
              style={{
                backgroundColor: "white",
                padding: "2rem",
              }}
            >
              <h2 style={{ color: "#0069b4", marginBottom: "1.5rem" }}>
                Hướng dẫn mở Chrome Dev Mode
              </h2>

              <div
                style={{
                  backgroundColor: "#e3f2fd",
                  border: "1px solid #2196f3",
                  borderRadius: "4px",
                  padding: "1rem",
                  marginBottom: "2rem",
                }}
              >
                <p style={{ color: "#1565c0", margin: 0 }}>
                  <strong>⚠️ Lưu ý quan trọng:</strong> Website không thể tự
                  động mở Chrome Dev Mode vì giới hạn bảo mật của browser. Bạn
                  cần mở thủ công bằng một trong các cách dưới đây.
                </p>
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "#333", marginBottom: "1rem" }}>
                  Cách 1: Chạy lệnh Terminal/Command Prompt (Khuyến nghị)
                </h3>
                <p style={{ color: "#666", marginBottom: "1rem" }}>
                  Chạy lệnh sau trong Terminal (macOS/Linux) hoặc Command Prompt
                  (Windows), sau đó mở website trong Chrome vừa mở:
                </p>
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "1rem",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    position: "relative",
                  }}
                >
                  <code style={{ fontSize: "14px" }}>
                    {getChromeCommand()} https://minv-tech-support.vercel.app/
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${getChromeCommand()} https://minv-tech-support.vercel.app/`
                      )
                    }
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "10px",
                      padding: "0.5rem 1rem",
                      backgroundColor: "#0069b4",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "#333", marginBottom: "1rem" }}>
                  Cách 2: Tạo Shortcut trên Desktop (Windows)
                </h3>
                <ol style={{ color: "#666", paddingLeft: "1.5rem" }}>
                  <li>Click chuột phải trên Desktop → New → Shortcut</li>
                  <li>Paste lệnh sau (thay đổi đường dẫn Chrome nếu cần):</li>
                </ol>
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "1rem",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    marginTop: "0.5rem",
                  }}
                >
                  <code>
                    "C:\Program Files\Google\Chrome\Application\chrome.exe"
                    --new-window --user-data-dir="%TEMP%\chrome_dev_test"
                    --disable-web-security https://minv-tech-support.vercel.app/
                  </code>
                </div>
                <ol style={{ color: "#666", paddingLeft: "1.5rem" }} start={3}>
                  <li>Đặt tên shortcut (ví dụ: "Chrome Dev Mode")</li>
                  <li>Double-click shortcut để mở Chrome Dev Mode</li>
                </ol>
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "#333", marginBottom: "1rem" }}>
                  Cách 3: Tạo Script trên macOS/Linux
                </h3>
                <p style={{ color: "#666", marginBottom: "1rem" }}>
                  Tạo file script để chạy nhanh:
                </p>
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "1rem",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    marginBottom: "0.5rem",
                  }}
                >
                  <code>
                    {os === "macos"
                      ? `#!/bin/bash\nopen -n -a /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security https://minv-tech-support.vercel.app/`
                      : `#!/bin/bash\ngoogle-chrome --new-window --user-data-dir="/tmp/chrome_dev_test" --disable-web-security https://minv-tech-support.vercel.app/`}
                  </code>
                </div>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  Lưu file với tên <code>chrome-dev.sh</code>, chạy{" "}
                  <code>chmod +x chrome-dev.sh</code>, sau đó chạy{" "}
                  <code>./chrome-dev.sh</code>
                </p>
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "#333", marginBottom: "1rem" }}>
                  Cách 4: Sử dụng Chrome Extension (Không khuyến nghị)
                </h3>
                <p style={{ color: "#666", marginBottom: "1rem" }}>
                  Cài đặt extension "CORS Unblock" hoặc tương tự để bypass CORS,
                  nhưng cách này không đảm bảo hoạt động tốt như Chrome Dev
                  Mode.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffc107",
                  borderRadius: "4px",
                  padding: "1rem",
                  marginTop: "2rem",
                }}
              >
                <p style={{ color: "#856404", margin: 0 }}>
                  <strong>Lưu ý:</strong> Chrome Dev Mode với{" "}
                  <code>--disable-web-security</code> chỉ nên dùng cho
                  development. Không dùng cho mục đích khác vì có thể gây rủi ro
                  bảo mật.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
