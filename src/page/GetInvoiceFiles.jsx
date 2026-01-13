import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import axios from "axios";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const GetInvoiceFiles = () => {
  const [excelFile, setExcelFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const domain = "http://bienlai70.vpdkddtphcm.com.vn";
  const authToken = "O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=";
  
  // Hàm helper để gọi API qua proxy nếu cần (khi chạy trên HTTPS)
  const callAPI = async (url, options = {}) => {
    // Kiểm tra nếu đang chạy trên HTTPS và URL là HTTP, dùng proxy
    const isHTTPS = window.location.protocol === 'https:';
    const isHTTPUrl = url.startsWith('http://');
    
    if (isHTTPS && isHTTPUrl) {
      // Sử dụng proxy API
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      return axios.get(proxyUrl, {
        ...options,
        params: {
          ...options.params,
          url: url
        }
      });
    }
    
    // Gọi trực tiếp nếu không cần proxy
    return axios(url, options);
  };

  // Parse Excel file
  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

          if (!jsonData || jsonData.length === 0) {
            reject(new Error("File Excel không có dữ liệu"));
            return;
          }

          // Lấy danh sách tất cả các tên cột có trong file để debug
          const allColumns =
            jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
          console.log("Các cột tìm thấy trong file Excel:", allColumns);

          // Hàm tìm giá trị theo nhiều tên cột có thể (không phân biệt hoa thường)
          const findValue = (row, possibleNames) => {
            // Tìm chính xác trước
            for (const name of possibleNames) {
              if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                return String(row[name]).trim();
              }
            }
            // Nếu không tìm thấy, tìm không phân biệt hoa thường
            const rowKeys = Object.keys(row);
            for (const possibleName of possibleNames) {
              const lowerPossible = possibleName.toLowerCase().trim();
              for (const key of rowKeys) {
                if (key.toLowerCase().trim() === lowerPossible) {
                  const value = row[key];
                  if (value !== undefined && value !== null && value !== "") {
                    return String(value).trim();
                  }
                }
              }
            }
            return "";
          };

          // Tìm các cột có thể chứa seri và number
          const invoices = jsonData.map((row, index) => {
            // Tìm seri (ký hiệu) - tất cả các biến thể có thể
            const seriNames = [
              "Ký hiệu",
              "Ký Hiệu",
              "Ky hieu",
              "Ky_hieu",
              "Ký hiệu *",
              "seri",
              "Seri",
              "SERI",
              "khieu",
            ];
            const seri = findValue(row, seriNames);

            // Tìm number (số hóa đơn) - tất cả các biến thể có thể
            const numberNames = [
              "Số hóa đơn",
              "Số hoá đơn",
              "Số Hoá Đơn",
              "So hoa don",
              "So_hoa_don",
              "Số đơn hàng *",
              "Số BL",
              "SoBL",
              "sdhang",
              "number",
              "Number",
              "NUMBER",
            ];
            const number = findValue(row, numberNames);

            return {
              index: index + 1,
              seri: String(seri).trim(),
              number: String(number).trim(),
            };
          });

          const validInvoices = invoices.filter(
            (inv) => inv.seri && inv.number
          );

          if (validInvoices.length === 0) {
            // Hiển thị lỗi chi tiết hơn
            const missingSeri = invoices.filter((inv) => !inv.seri).length;
            const missingNumber = invoices.filter((inv) => !inv.number).length;
            reject(
              new Error(
                `Không tìm thấy dữ liệu hợp lệ. ` +
                  `Các cột có trong file: ${allColumns.join(", ")}. ` +
                  `${missingSeri} dòng thiếu "Ký hiệu", ${missingNumber} dòng thiếu "Số hóa đơn". ` +
                  `Vui lòng kiểm tra tên cột trong file Excel.`
              )
            );
            return;
          }

          resolve(validInvoices);
        } catch (error) {
          console.error("Lỗi khi đọc file Excel:", error);
          reject(new Error("Không thể đọc file Excel: " + error.message));
        }
      };
      reader.onerror = (error) => {
        console.error("Lỗi khi mở file:", error);
        reject(
          new Error(
            "Không thể mở file. Vui lòng kiểm tra file có đúng định dạng Excel (.xlsx hoặc .xls) không."
          )
        );
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Lấy thông tin hóa đơn để lấy ID
  const getInvoiceInfo = async (seri, number) => {
    try {
      const url = `${domain}/api/InvoiceApi78/GetInfoInvoice?seri=${encodeURIComponent(
        seri
      )}&number=${encodeURIComponent(number)}`;

      // Sử dụng proxy nếu cần
      const isHTTPS = window.location.protocol === 'https:';
      let response;
      
      if (isHTTPS) {
        // Gọi qua proxy - truyền headers qua query params
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&authorization=${encodeURIComponent(`Bear ${authToken}`)}&accept=*/*`;
        response = await axios.get(proxyUrl);
      } else {
        // Gọi trực tiếp
        response = await axios.get(url, {
          headers: {
            Accept: "*/*",
            Authorization: `Bear ${authToken}`,
          },
        });
      }

      if (response.data && response.data.code === "00" && response.data.data) {
        return {
          success: true,
          id: response.data.data.hoadon68_id,
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          error: response.data?.message || "Không tìm thấy hóa đơn",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  };

  // Lấy file XML
  const getXMLFile = async (invoiceId) => {
    try {
      const url = `${domain}/api/Invoice68/ExportFileXML?id=${invoiceId}`;
      const isHTTPS = window.location.protocol === 'https:';
      
      let response;
      if (isHTTPS) {
        // Gọi qua proxy - truyền headers qua query params
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&authorization=${encodeURIComponent(`Bear ${authToken};VP;vi`)}&accept=*/*&accept-language=${encodeURIComponent("vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5")}&cache-control=no-cache&connection=keep-alive&pragma=no-cache&referer=${encodeURIComponent(`${domain}/`)}&user-agent=${encodeURIComponent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36")}`;
        response = await axios.get(proxyUrl, {
          responseType: "blob",
        });
      } else {
        // Gọi trực tiếp
        response = await axios.get(url, {
          headers: {
            Accept: "*/*",
            "Accept-Language":
              "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
            Authorization: `Bear ${authToken};VP;vi`,
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            Pragma: "no-cache",
            Referer: `${domain}/`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          },
          responseType: "blob",
        });
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  };

  // Lấy file PDF
  const getPDFFile = async (invoiceId) => {
    try {
      const url = `${domain}/api/Invoice68/PrintInvoice?id=${invoiceId}&type=PDF&inchuyendoi=false`;
      const isHTTPS = window.location.protocol === 'https:';
      
      let response;
      if (isHTTPS) {
        // Gọi qua proxy - truyền headers qua query params
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&authorization=${encodeURIComponent(`Bear ${authToken};VP;vi`)}&accept=*/*&accept-language=${encodeURIComponent("vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5")}&cache-control=no-cache&connection=keep-alive&content-type=application/json&pragma=no-cache&referer=${encodeURIComponent(`${domain}/`)}&user-agent=${encodeURIComponent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36")}`;
        response = await axios.get(proxyUrl, {
          responseType: "blob",
        });
      } else {
        // Gọi trực tiếp
        response = await axios.get(url, {
          headers: {
            Accept: "*/*",
            "Accept-Language":
              "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
            Authorization: `Bear ${authToken};VP;vi`,
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Content-type": "application/json",
            Pragma: "no-cache",
            Referer: `${domain}/`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          },
          responseType: "blob",
        });
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  };

  // Xử lý tải file
  const handleDownload = async () => {
    if (!excelFile) {
      toast.error(
        <ToastNotify status={-1} message="Vui lòng chọn file Excel" />,
        { style: styleError }
      );
      return;
    }

    setProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: 0 });

    try {
      // Parse Excel
      const invoices = await parseExcelFile(excelFile);

      if (invoices.length === 0) {
        toast.error(
          <ToastNotify
            status={-1}
            message="Không tìm thấy dữ liệu hóa đơn hợp lệ"
          />,
          { style: styleError }
        );
        setProcessing(false);
        return;
      }

      setProgress({ current: 0, total: invoices.length });

      const zip = new JSZip();
      const newResults = [];
      let successCount = 0;
      let failCount = 0;

      // Xử lý từng hóa đơn
      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];
        setProgress({ current: i + 1, total: invoices.length });

        try {
          // Bước 1: Lấy ID hóa đơn
          const infoResult = await getInvoiceInfo(invoice.seri, invoice.number);

          if (!infoResult.success || !infoResult.id) {
            newResults.push({
              ...invoice,
              status: "error",
              message: infoResult.error || "Không lấy được ID hóa đơn",
            });
            failCount++;
            continue;
          }

          const invoiceId = infoResult.id;
          const folderName = `${invoice.seri}_${invoice.number}`;
          const invoiceFolder = zip.folder(folderName);

          // Bước 2: Lấy XML
          const xmlResult = await getXMLFile(invoiceId);
          if (xmlResult.success) {
            invoiceFolder.file(`${folderName}.xml`, xmlResult.data);
          }

          // Bước 3: Lấy PDF
          const pdfResult = await getPDFFile(invoiceId);
          if (pdfResult.success) {
            invoiceFolder.file(`${folderName}.pdf`, pdfResult.data);
          }

          if (xmlResult.success && pdfResult.success) {
            newResults.push({
              ...invoice,
              status: "success",
              message: "Đã tải thành công PDF và XML",
              id: invoiceId,
            });
            successCount++;
          } else {
            newResults.push({
              ...invoice,
              status: "partial",
              message: `XML: ${xmlResult.success ? "OK" : "Lỗi"}, PDF: ${
                pdfResult.success ? "OK" : "Lỗi"
              }`,
              id: invoiceId,
            });
            failCount++;
          }
        } catch (error) {
          newResults.push({
            ...invoice,
            status: "error",
            message: error.message || "Lỗi không xác định",
          });
          failCount++;
        }

        setResults([...newResults]);
      }

      // Tạo và tải file ZIP
      if (successCount > 0 || newResults.some((r) => r.status === "partial")) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;

        // Tạo tên file theo cú pháp: kyhieu_sohoadon.zip
        // Lấy từ hóa đơn đầu tiên thành công
        const firstSuccessInvoice = newResults.find(
          (r) => r.status === "success" || r.status === "partial"
        );
        let zipFileName = "HoaDon_PDF_XML.zip"; // Tên mặc định

        if (firstSuccessInvoice) {
          zipFileName = `${firstSuccessInvoice.seri}_${firstSuccessInvoice.number}.zip`;
        } else if (newResults.length > 0) {
          // Nếu không có hóa đơn thành công, lấy hóa đơn đầu tiên
          const firstInvoice = newResults[0];
          zipFileName = `${firstInvoice.seri}_${firstInvoice.number}.zip`;
        }

        link.download = zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      // Thông báo kết quả
      toast.success(
        <ToastNotify
          status={0}
          message={`Hoàn thành: ${successCount} thành công, ${failCount} thất bại`}
        />,
        { style: styleSuccess }
      );
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = error.message || "Đã xảy ra lỗi";
      toast.error(<ToastNotify status={-1} message={errorMessage} />, {
        style: styleError,
      });
      // Hiển thị lỗi chi tiết trong console để debug
      if (errorMessage.includes("Các cột có trong file")) {
        console.log("Chi tiết lỗi:", errorMessage);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setResults([]);
    }
  };

  // Tạo và tải file Excel mẫu
  const downloadSampleExcel = () => {
    // Tạo dữ liệu mẫu
    const sampleData = [
      { "Ký hiệu": "1C25TBK", "Số hóa đơn": "25" },
      { "Ký hiệu": "1C26TBK", "Số hóa đơn": "26" },
      { "Ký hiệu": "1C27TBK", "Số hóa đơn": "27" },
    ];

    // Tạo workbook và worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(wb, ws, "HoaDon");

    // Tạo file Excel và tải xuống
    XLSX.writeFile(wb, "Mau_File_HoaDon.xlsx");

    toast.success(
      <ToastNotify status={0} message="Đã tải file Excel mẫu thành công" />,
      { style: styleSuccess }
    );
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "1200px",
        margin: "0 auto",
        backgroundColor: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <ToastContainer />
      <h2 style={{ marginBottom: "20px", color: "#0069b4" }}>
        Lấy PDF và XML hóa đơn hàng loạt
      </h2>

      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <label
            style={{
              display: "block",
              fontWeight: "bold",
              flex: 1,
            }}
          >
            Chọn file Excel (bắt buộc có 2 cột: "Ký hiệu" và "Số hóa đơn")
          </label>
          <button
            onClick={downloadSampleExcel}
            style={{
              padding: "8px 16px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              cursor: "pointer",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Tải file Excel mẫu"
          >
            <i className="fa-solid fa-download"></i>
            Tải file mẫu
          </button>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={processing}
          style={{
            padding: "8px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            width: "100%",
            maxWidth: "400px",
          }}
        />
        {excelFile && (
          <div style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
            Đã chọn: {excelFile.name}
          </div>
        )}
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
          <strong>Yêu cầu:</strong> File Excel phải có 2 cột:
          <ul style={{ marginTop: "4px", marginLeft: "20px" }}>
            <li>
              <strong>"Ký hiệu"</strong> (hoặc "Ky hieu", "Ky_hieu", "seri")
            </li>
            <li>
              <strong>"Số hóa đơn"</strong> hoặc <strong>"Số hoá đơn"</strong>{" "}
              (hoặc "So hoa don", "So_hoa_don", "number", "sdhang")
            </li>
          </ul>
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#f0f0f0",
              borderRadius: "4px",
            }}
          >
            <strong>Ví dụ:</strong>
            <table
              style={{
                marginTop: "8px",
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#ddd" }}>
                  <th style={{ padding: "4px 8px", border: "1px solid #999" }}>
                    Ký hiệu
                  </th>
                  <th style={{ padding: "4px 8px", border: "1px solid #999" }}>
                    Số hóa đơn
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", border: "1px solid #999" }}>
                    1C25TBK
                  </td>
                  <td style={{ padding: "4px 8px", border: "1px solid #999" }}>
                    25
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", border: "1px solid #999" }}>
                    1C26TBK
                  </td>
                  <td style={{ padding: "4px 8px", border: "1px solid #999" }}>
                    26
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {processing && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", marginBottom: "8px" }}>
            Đang xử lý: {progress.current} / {progress.total}
          </div>
          <div
            style={{
              width: "100%",
              height: "20px",
              backgroundColor: "#f0f0f0",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${
                  progress.total > 0
                    ? (progress.current / progress.total) * 100
                    : 0
                }%`,
                height: "100%",
                backgroundColor: "#007bff",
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={processing || !excelFile}
        style={{
          padding: "12px 24px",
          backgroundColor: processing || !excelFile ? "#ccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "16px",
          cursor: processing || !excelFile ? "not-allowed" : "pointer",
          fontWeight: "bold",
          marginBottom: "20px",
        }}
      >
        {processing ? "Đang xử lý..." : "Tải PDF và XML"}
      </button>

      {results.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h3 style={{ marginBottom: "15px" }}>Kết quả</h3>
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    STT
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Ký hiệu
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Số HĐ
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Trạng thái
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Thông báo
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr
                    key={index}
                    style={{
                      backgroundColor:
                        result.status === "success"
                          ? "#d4edda"
                          : result.status === "partial"
                          ? "#fff3cd"
                          : "#f8d7da",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    <td style={{ padding: "10px" }}>{result.index}</td>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>
                      {result.seri}
                    </td>
                    <td style={{ padding: "10px" }}>{result.number}</td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          backgroundColor:
                            result.status === "success"
                              ? "#28a745"
                              : result.status === "partial"
                              ? "#ffc107"
                              : "#dc3545",
                          color: "white",
                          fontSize: "12px",
                        }}
                      >
                        {result.status === "success"
                          ? "Thành công"
                          : result.status === "partial"
                          ? "Một phần"
                          : "Thất bại"}
                      </span>
                    </td>
                    <td style={{ padding: "10px", fontSize: "12px" }}>
                      {result.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GetInvoiceFiles;
