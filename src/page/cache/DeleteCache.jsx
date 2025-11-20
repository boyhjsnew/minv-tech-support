import React, { useState, useRef } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Card } from "primereact/card";
import { Toast } from "primereact/toast";
import { InputNumber } from "primereact/inputnumber";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { FileUpload } from "primereact/fileupload";
import { ProgressBar } from "primereact/progressbar";
import { Panel } from "primereact/panel";
import CryptoJS from "crypto-js";
import * as XLSX from "xlsx";
// theme
import "primereact/resources/themes/lara-light-cyan/theme.css";

const KEY_EMAIL = "6DEA50C84B9506624BE9";
const DEFAULT_KHIEU = ""; // Ký hiệu mặc định

export default function DeleteCache() {
  const [type, setType] = useState("Gửi hóa đơn");
  const [id, setId] = useState("");
  const [nguoiNhan, setNguoiNhan] = useState("");
  const [shdon, setShdon] = useState(null);
  const [emailList, setEmailList] = useState([]);
  const [cctbaoId, setCctbaoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [progress, setProgress] = useState({
    currentBatch: 0,
    totalBatches: 0,
    currentSent: 0,
    totalCount: 0,
    percentage: 0,
    status: "", // "Đang lấy dữ liệu...", "Đang gửi email...", "Đang đợi..."
  });
  const toast = useRef(null);
  const fileUploadRef = useRef(null);

  // Hàm format thời gian theo định dạng "DD/MM/YYYY HH"
  const formatDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hour = String(now.getHours()).padStart(2, "0");
    return `${day}/${month}/${year} ${hour}`;
  };

  // Hàm tính secret key từ email, KEY_EMAIL và thời gian
  const calculateSecret = (email) => {
    if (!email) {
      return "";
    }
    const dateTime = formatDateTime();
    const stringToHash = `${email}${KEY_EMAIL}${dateTime}`;
    const hash = CryptoJS.MD5(stringToHash).toString();
    return hash;
  };

  // Hàm gửi email cho một batch dữ liệu
  const sendEmailBatch = async (emailData) => {
    if (!type.trim()) {
      throw new Error("Vui lòng nhập Type");
    }

    if (emailData.length === 0) {
      return;
    }

    try {
      // Tính secret cho mỗi email và tạo payload
      const emailPayload = emailData.map((item) => ({
        id: item.id,
        nguoi_nhan: item.nguoi_nhan,
        shdon: item.shdon,
        khieu: item.khieu || DEFAULT_KHIEU,
        scret: calculateSecret(item.nguoi_nhan),
      }));

      const payload = {
        id: emailPayload,
        type: type.trim(),
      };

      const response = await fetch(
        "http://bienlai70.vpdkddtphcm.com.vn/api/Invoice68/EmailMulti",
        {
          method: "POST",
          headers: {
            Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
            Referer: "http://bienlai70.vpdkddtphcm.com.vn/",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        // Thử đọc error message từ response nếu có
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (e) {
          // Nếu không đọc được error message, dùng message mặc định
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        const responseText = await response.text();
        if (responseText) {
          result = JSON.parse(responseText);
        } else {
          throw new Error("Response rỗng");
        }
      } catch (parseError) {
        throw new Error(`Không thể parse response: ${parseError.message}`);
      }

      if (result.code !== "00") {
        throw new Error(result.message || "Gửi email thất bại");
      }

      return result;
    } catch (error) {
      // Đảm bảo luôn throw error để được catch ở nơi gọi
      throw error;
    }
  };

  // Hàm lấy dữ liệu và tự động gửi email
  const handleFetchData = async () => {
    if (!cctbaoId.trim()) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng nhập CCTBao ID",
        life: 3000,
      });
      return;
    }

    if (!type.trim()) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng nhập Type",
        life: 3000,
      });
      return;
    }

    setFetchingData(true);
    setEmailList([]);
    setLoading(true);
    // Reset progress
    setProgress({
      currentBatch: 0,
      totalBatches: 0,
      currentSent: 0,
      totalCount: 0,
      percentage: 0,
      status: "Đang khởi tạo...",
    });

    try {
      let start = 0;
      const count = 50; // Số lượng bản ghi mỗi lần lấy và gửi
      let totalCount = 0;
      let totalSent = 0;
      let hasMore = true;
      let batchNumber = 1;
      let hasDataFromAPI = false; // Theo dõi xem API có trả về data không
      let totalInvalidData = 0; // Đếm số bản ghi không hợp lệ

      while (hasMore) {
        try {
          // Cập nhật trạng thái: Đang lấy dữ liệu
          const currentBatchNum = batchNumber;
          setProgress((prev) => ({
            ...prev,
            status: `Đang lấy dữ liệu batch ${currentBatchNum}...`,
          }));

          // Lấy dữ liệu từ API
          const payload = {
            command: "CM0009",
            start: start,
            count: count,
            filter: [
              {
                columnName: "is_send_email",
                columnType: "bit",
                value: "False",
              },
            ],
            tlbparam: [
              {
                columnName: "cctbao_id",
                value: cctbaoId.trim(),
              },
            ],
            isListAll: true,
          };

          let response;
          try {
            response = await fetch(
              "http://bienlai70.vpdkddtphcm.com.vn/api/Pattern/GetData",
              {
                method: "POST",
                headers: {
                  Accept: "*/*",
                  "Accept-Language":
                    "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
                  Authorization:
                    "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
                  "Cache-Control": "no-cache",
                  Connection: "keep-alive",
                  "Content-Type": "application/json",
                  Origin: "http://bienlai70.vpdkddtphcm.com.vn",
                  Pragma: "no-cache",
                  Referer: "http://bienlai70.vpdkddtphcm.com.vn/",
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
                },
                body: JSON.stringify(payload),
              }
            );
          } catch (fetchError) {
            console.error("Error fetching data:", fetchError);
            setProgress((prev) => ({
              ...prev,
              status: `Lỗi khi lấy dữ liệu batch ${currentBatchNum}: ${fetchError.message}`,
            }));
            toast.current.show({
              severity: "error",
              summary: "Lỗi lấy dữ liệu",
              detail: `Lỗi khi lấy dữ liệu batch ${currentBatchNum}: ${fetchError.message}. Đang thử lại sau 5 giây...`,
              life: 5000,
            });
            // Đợi 5 giây rồi thử lại batch này
            await new Promise((resolve) => setTimeout(resolve, 5000));
            continue; // Thử lại batch này
          }

          if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
              const errorText = await response.text();
              if (errorText) {
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.message || errorMessage;
                } catch {
                  errorMessage = errorText || errorMessage;
                }
              }
            } catch (e) {
              // Nếu không đọc được error message, dùng message mặc định
            }
            throw new Error(errorMessage);
          }

          let result;
          try {
            const responseText = await response.text();
            if (responseText) {
              result = JSON.parse(responseText);
            } else {
              throw new Error("Response rỗng");
            }
          } catch (parseError) {
            throw new Error(`Không thể parse response: ${parseError.message}`);
          }

          // Kiểm tra xem API có trả về data không
          if (result.data && Array.isArray(result.data)) {
            if (result.data.length > 0) {
              hasDataFromAPI = true;
            }

            // Cập nhật totalCount ngay khi có (không cần đợi mappedData)
            if (totalCount === 0 && result.total_count) {
              totalCount = result.total_count;
              const totalBatches = Math.ceil(totalCount / count);
              const finalTotalCount = totalCount; // Lưu vào biến local để tránh unsafe reference
              setProgress((prev) => ({
                ...prev,
                totalCount: finalTotalCount,
                totalBatches: totalBatches,
              }));
            }

            // Map dữ liệu từ API sang format cần thiết
            const currentStart = start;
            const mappedData = result.data
              .filter((item) => item.email && item.hoadon68_id && item.shdon)
              .map((item, index) => ({
                id: item.hoadon68_id || item.id,
                nguoi_nhan: item.email,
                shdon: parseInt(item.shdon, 10) || 0,
                khieu: item.khieu || DEFAULT_KHIEU,
                index: currentStart + index + 1,
              }));

            // Đếm số bản ghi không hợp lệ
            const invalidCount = result.data.length - mappedData.length;
            totalInvalidData += invalidCount;

            if (mappedData.length === 0) {
              // Nếu không có dữ liệu hợp lệ trong batch này, kiểm tra xem còn batch khác không
              // Sử dụng totalCount đã được cập nhật hoặc result.total_count
              const currentTotalCount = totalCount || result.total_count || 0;
              if (
                result.data.length < count ||
                start + count >= currentTotalCount ||
                currentTotalCount === 0
              ) {
                hasMore = false;
                break;
              } else {
                // Vẫn còn batch khác, tiếp tục
                start += count;
                batchNumber++;
                const currentBatchNum = batchNumber; // Lưu vào biến local để tránh unsafe reference
                const prevBatchNum = batchNumber - 1;
                setProgress((prev) => ({
                  ...prev,
                  status: `Đang đợi 5 giây trước batch ${currentBatchNum}... (Batch ${prevBatchNum} không có dữ liệu hợp lệ)`,
                }));
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue;
              }
            }

            // Cập nhật UI
            setEmailList((prev) => [...prev, ...mappedData]);

            // Cập nhật trạng thái: Đang gửi email
            const currentBatchForSend = batchNumber;
            setProgress((prev) => ({
              ...prev,
              currentBatch: currentBatchForSend,
              status: `Đang gửi email batch ${currentBatchForSend}...`,
            }));

            // Gửi email cho batch này
            try {
              await sendEmailBatch(mappedData);
              totalSent += mappedData.length;

              // Cập nhật tiến độ sau khi gửi thành công
              const finalTotalSent = totalSent;
              const finalTotalCount = totalCount;
              const finalBatchNum = batchNumber;
              const percentage =
                finalTotalCount > 0
                  ? Math.round((finalTotalSent / finalTotalCount) * 100)
                  : 0;
              setProgress((prev) => ({
                ...prev,
                currentSent: finalTotalSent,
                percentage: percentage,
                status: `Đã gửi batch ${finalBatchNum}: ${mappedData.length} hóa đơn`,
              }));

              toast.current.show({
                severity: "success",
                summary: "Thành công",
                detail: `Đã gửi email batch ${batchNumber}: ${mappedData.length} hóa đơn (Tổng: ${totalSent}/${totalCount})`,
                life: 3000,
              });

              batchNumber++;
            } catch (emailError) {
              console.error("Error sending email batch:", emailError);
              toast.current.show({
                severity: "error",
                summary: "Lỗi gửi email",
                detail: `Lỗi khi gửi email batch ${batchNumber}: ${emailError.message}`,
                life: 5000,
              });
              // Tiếp tục với batch tiếp theo dù có lỗi
              batchNumber++;
            }

            // Kiểm tra xem còn dữ liệu không
            // Nếu totalCount đã được set, kiểm tra dựa trên totalCount
            // Nếu chưa, kiểm tra dựa trên số lượng data trả về
            const shouldStop =
              result.data.length < count ||
              (totalCount > 0 && start + result.data.length >= totalCount) ||
              (totalCount > 0 && start + count >= totalCount);

            if (shouldStop) {
              hasMore = false;
              setProgress((prev) => ({
                ...prev,
                status: "Hoàn thành!",
              }));
            } else {
              start += count;
              // Cập nhật trạng thái: Đang đợi
              const nextBatchNum = batchNumber;
              setProgress((prev) => ({
                ...prev,
                status: `Đang đợi 5 giây trước batch ${nextBatchNum}...`,
              }));
              // Đợi 5 giây trước khi lấy batch tiếp theo
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
          } else {
            // Nếu result.data không tồn tại hoặc không phải mảng
            // Kiểm tra xem có total_count không để xác định có data hay không
            if (result.total_count && result.total_count > 0) {
              hasDataFromAPI = true;
            }
            hasMore = false;
          }
        } catch (batchError) {
          // Xử lý lỗi cho toàn bộ batch
          console.error("Error processing batch:", batchError);
          const currentBatchNum = batchNumber;
          setProgress((prev) => ({
            ...prev,
            status: `Lỗi batch ${currentBatchNum}: ${batchError.message}`,
          }));
          toast.current.show({
            severity: "error",
            summary: "Lỗi xử lý batch",
            detail: `Lỗi khi xử lý batch ${currentBatchNum}: ${batchError.message}. Đang tiếp tục với batch tiếp theo...`,
            life: 5000,
          });
          // Tiếp tục với batch tiếp theo dù có lỗi
          batchNumber++;
          start += count;
          // Đợi 5 giây trước khi thử batch tiếp theo
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      // Thông báo hoàn thành
      if (totalSent > 0) {
        let detailMessage = `Đã gửi email thành công cho ${totalSent} hóa đơn`;
        if (totalInvalidData > 0) {
          detailMessage += ` (${totalInvalidData} bản ghi không hợp lệ đã bỏ qua)`;
        }
        toast.current.show({
          severity: "success",
          summary: "Hoàn thành",
          detail: detailMessage,
          life: 5000,
        });
      } else {
        // Phân biệt giữa "không có data" và "có data nhưng không hợp lệ"
        if (hasDataFromAPI) {
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail: `API trả về dữ liệu nhưng không có bản ghi hợp lệ để gửi email. ${
              totalInvalidData > 0
                ? `(${totalInvalidData} bản ghi không đủ thông tin: email, hoadon68_id, hoặc shdon)`
                : "Vui lòng kiểm tra dữ liệu từ API."
            }`,
            life: 5000,
          });
        } else {
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail: "Không tìm thấy hóa đơn nào chưa gửi email",
            life: 3000,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setProgress((prev) => ({
        ...prev,
        status: `Lỗi: ${error.message || "Có lỗi xảy ra"}`,
      }));
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: error.message || "Có lỗi xảy ra khi lấy dữ liệu",
        life: 3000,
      });
    } finally {
      setFetchingData(false);
      setLoading(false);
      // Giữ progress để người dùng xem kết quả cuối cùng
    }
  };

  // Hàm tải file Excel mẫu
  const handleDownloadTemplate = () => {
    try {
      // Tạo dữ liệu mẫu
      const sampleData = [
        {
          ID: "41b1df2f-7d4f-4ec0-9fbd-fc8fde4cc233",
          Email: "example1@email.com",
          "Số Hóa Đơn": 10,
        },
        {
          ID: "abc123-def456-ghi789",
          Email: "example2@email.com",
          "Số Hóa Đơn": 20,
        },
      ];

      // Tạo workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sampleData);

      // Set độ rộng cột
      ws["!cols"] = [
        { wch: 40 }, // ID
        { wch: 30 }, // Email
        { wch: 15 }, // Số Hóa Đơn
      ];

      // Thêm worksheet vào workbook
      XLSX.utils.book_append_sheet(wb, ws, "Mẫu");

      // Tạo file và download
      const fileName = `Mau_File_Email_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.current.show({
        severity: "success",
        summary: "Thành công",
        detail: "Đã tải file mẫu thành công",
        life: 3000,
      });
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: "Có lỗi xảy ra khi tải file mẫu",
        life: 3000,
      });
    }
  };

  // Hàm xử lý import file Excel
  const handleImportExcel = (event) => {
    const file = event.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail: "File Excel không có dữ liệu",
            life: 3000,
          });
          return;
        }

        // Parse dữ liệu từ Excel
        // Format: cột A = id, cột B = nguoi_nhan, cột C = shdon
        // Hoặc có header: ID, Email, Số Hóa Đơn
        const parsedData = jsonData
          .map((row, index) => {
            // Lấy tất cả các key có thể
            const keys = Object.keys(row);

            // Tìm cột ID (ưu tiên theo thứ tự)
            let id = "";
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes("id") || keys.indexOf(key) === 0) {
                id = row[key];
                break;
              }
            }
            if (!id && keys.length > 0) id = Object.values(row)[0];

            // Tìm cột Email
            let nguoi_nhan = "";
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes("email") ||
                lowerKey.includes("nguoi") ||
                lowerKey.includes("người") ||
                keys.indexOf(key) === 1
              ) {
                nguoi_nhan = row[key];
                break;
              }
            }
            if (!nguoi_nhan && keys.length > 1)
              nguoi_nhan = Object.values(row)[1];

            // Tìm cột Số Hóa Đơn
            let shdon = 0;
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes("số") ||
                lowerKey.includes("so") ||
                lowerKey.includes("hóa") ||
                lowerKey.includes("hoa") ||
                lowerKey.includes("đơn") ||
                lowerKey.includes("don") ||
                lowerKey.includes("shdon") ||
                keys.indexOf(key) === 2
              ) {
                shdon = row[key];
                break;
              }
            }
            if (!shdon && keys.length > 2) shdon = Object.values(row)[2];

            return {
              id: String(id || "").trim(),
              nguoi_nhan: String(nguoi_nhan || "").trim(),
              shdon: parseInt(shdon, 10) || 0,
              khieu: DEFAULT_KHIEU,
              index: index + 1,
            };
          })
          .filter((item) => item.id && item.nguoi_nhan && item.shdon > 0);

        if (parsedData.length === 0) {
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail:
              "Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra format: ID, Email, Số Hóa Đơn",
            life: 5000,
          });
          return;
        }

        setEmailList(parsedData);
        toast.current.show({
          severity: "success",
          summary: "Thành công",
          detail: `Đã import ${parsedData.length} bản ghi từ file Excel`,
          life: 3000,
        });
      } catch (error) {
        console.error("Error parsing Excel:", error);
        toast.current.show({
          severity: "error",
          summary: "Lỗi",
          detail: "Có lỗi xảy ra khi đọc file Excel",
          life: 3000,
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSendEmailMulti = async () => {
    if (!type.trim()) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng nhập Type",
        life: 3000,
      });
      return;
    }

    let emailData = [];

    // Nếu có dữ liệu từ Excel, sử dụng dữ liệu đó
    if (emailList.length > 0) {
      emailData = emailList.map((item) => ({
        id: item.id,
        nguoi_nhan: item.nguoi_nhan,
        shdon: item.shdon,
        khieu: item.khieu || DEFAULT_KHIEU,
        scret: calculateSecret(item.nguoi_nhan),
      }));
    } else {
      // Nếu không có dữ liệu từ Excel, kiểm tra dữ liệu nhập thủ công
      if (!id.trim()) {
        toast.current.show({
          severity: "warn",
          summary: "Cảnh báo",
          detail: "Vui lòng nhập ID hoặc import file Excel",
          life: 3000,
        });
        return;
      }

      if (!nguoiNhan.trim()) {
        toast.current.show({
          severity: "warn",
          summary: "Cảnh báo",
          detail: "Vui lòng nhập Email người nhận hoặc import file Excel",
          life: 3000,
        });
        return;
      }

      if (!shdon || shdon <= 0) {
        toast.current.show({
          severity: "warn",
          summary: "Cảnh báo",
          detail: "Vui lòng nhập Số hóa đơn hoặc import file Excel",
          life: 3000,
        });
        return;
      }

      // Tính secret từ email người nhận
      const scret = calculateSecret(nguoiNhan);

      emailData = [
        {
          id: id.trim(),
          nguoi_nhan: nguoiNhan.trim(),
          shdon: shdon,
          khieu: DEFAULT_KHIEU,
          scret: scret,
        },
      ];
    }

    if (emailData.length === 0) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Không có dữ liệu để gửi email",
        life: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      console.log("Email Data:", emailData);
      console.log("DateTime:", formatDateTime());

      const payload = {
        id: emailData,
        type: type.trim(),
      };

      console.log("Email Payload:", payload);

      const response = await fetch(
        "http://bienlai70.vpdkddtphcm.com.vn/api/Invoice68/EmailMulti",
        {
          method: "POST",
          headers: {
            Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
            Referer: "http://bienlai70.vpdkddtphcm.com.vn/",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Email Send Result:", result);

      // Kiểm tra code === "00" là thành công (kể cả khi data là mảng rỗng)
      if (result.code === "00") {
        toast.current.show({
          severity: "success",
          summary: "Thành công",
          detail:
            result.message ||
            `Đã gửi email thành công cho ${emailData.length} bản ghi`,
          life: 3000,
        });
        // Xóa dữ liệu sau khi gửi thành công
        setId("");
        setNguoiNhan("");
        setShdon(null);
        setEmailList([]);
        setCctbaoId("");
        if (fileUploadRef.current) {
          fileUploadRef.current.clear();
        }
      } else {
        throw new Error(result.message || "Gửi email thất bại");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: error.message || "Có lỗi xảy ra khi gửi email",
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <Toast ref={toast} />

      <Card title="Gửi Email Multi" className="mb-4">
        <div className="flex flex-column gap-4">
          <div className="field">
            <label htmlFor="type" className="font-bold">
              Type <span className="text-red-500">*</span>
            </label>
            <InputText
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Nhập Type"
              className="w-full"
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Mặc định: "Gửi hóa đơn"
            </small>
          </div>

          <div className="field">
            <label htmlFor="cctbaoId" className="font-bold">
              CCTBao ID <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <InputText
                id="cctbaoId"
                value={cctbaoId}
                onChange={(e) => setCctbaoId(e.target.value)}
                placeholder="Nhập CCTBao ID"
                className="flex-1"
              />
              <Button
                label="Tự động lấy và gửi email"
                icon="pi pi-send"
                onClick={handleFetchData}
                loading={fetchingData || loading}
                className="p-button-primary"
                disabled={!cctbaoId.trim() || !type.trim()}
              />
            </div>
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Tự động lấy 50 hóa đơn chưa gửi email, gửi email, đợi 5s rồi tiếp
              tục cho đến hết
            </small>
          </div>

          {/* Hiển thị tiến độ */}
          {(fetchingData || loading) && progress.totalCount > 0 && (
            <Panel header="Tiến độ xử lý" className="mb-3">
              <div className="flex flex-column gap-3">
                <div>
                  <div className="flex justify-content-between align-items-center mb-2">
                    <span className="font-bold">{progress.status}</span>
                    <span className="text-600">{progress.percentage}%</span>
                  </div>
                  <ProgressBar value={progress.percentage} />
                </div>

                <div className="grid">
                  <div className="col-12 md:col-6">
                    <div className="flex flex-column">
                      <span className="text-600 text-sm mb-1">
                        Batch hiện tại
                      </span>
                      <span className="font-bold text-lg">
                        {progress.currentBatch} / {progress.totalBatches}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="flex flex-column">
                      <span className="text-600 text-sm mb-1">
                        Hóa đơn đã gửi
                      </span>
                      <span className="font-bold text-lg">
                        {progress.currentSent} / {progress.totalCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2 border-1 border-200 border-round bg-blue-50">
                  <small className="text-600">
                    <i className="pi pi-info-circle mr-1"></i>
                    {progress.status}
                  </small>
                </div>
              </div>
            </Panel>
          )}

          <div className="flex align-items-center gap-2">
            <div className="flex-1 border-top-1 border-300"></div>
            <span className="text-600">HOẶC</span>
            <div className="flex-1 border-top-1 border-300"></div>
          </div>

          <div className="field">
            <div className="flex justify-content-between align-items-center mb-2">
              <label className="font-bold m-0">Import File Excel</label>
              <Button
                label="Tải File Mẫu"
                icon="pi pi-download"
                onClick={handleDownloadTemplate}
                className="p-button-outlined p-button-secondary"
                size="small"
              />
            </div>
            <FileUpload
              ref={fileUploadRef}
              name="excelFile"
              accept=".xlsx,.xls"
              maxFileSize={10000000}
              customUpload
              uploadHandler={handleImportExcel}
              auto
              chooseLabel="Chọn File Excel"
              className="w-full"
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Format file Excel: Cột A = ID, Cột B = Email, Cột C = Số Hóa Đơn
              <br />
              Hoặc có thể nhập thủ công bên dưới
            </small>
          </div>

          {emailList.length > 0 && (
            <div className="field">
              <label className="font-bold">
                Danh sách đã import ({emailList.length} bản ghi)
              </label>
              <DataTable
                value={emailList}
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 20, 50]}
                className="p-datatable-sm"
              >
                <Column field="index" header="STT" style={{ width: "5rem" }} />
                <Column field="id" header="ID" />
                <Column field="nguoi_nhan" header="Email Người Nhận" />
                <Column field="shdon" header="Số Hóa Đơn" />
                <Column field="khieu" header="Ký Hiệu" />
              </DataTable>
            </div>
          )}

          <div className="flex align-items-center gap-2">
            <div className="flex-1 border-top-1 border-300"></div>
            <span className="text-600">HOẶC</span>
            <div className="flex-1 border-top-1 border-300"></div>
          </div>

          <div className="field">
            <label htmlFor="id" className="font-bold">
              ID <span className="text-red-500">*</span>
            </label>
            <InputText
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Nhập ID hóa đơn"
              className="w-full"
            />
          </div>

          <div className="field">
            <label htmlFor="nguoiNhan" className="font-bold">
              Email Người Nhận <span className="text-red-500">*</span>
            </label>
            <InputText
              id="nguoiNhan"
              value={nguoiNhan}
              onChange={(e) => setNguoiNhan(e.target.value)}
              placeholder="Nhập email người nhận"
              className="w-full"
            />
          </div>

          <div className="field">
            <label htmlFor="shdon" className="font-bold">
              Số Hóa Đơn <span className="text-red-500">*</span>
            </label>
            <InputNumber
              id="shdon"
              value={shdon}
              onValueChange={(e) => setShdon(e.value)}
              placeholder="Nhập số hóa đơn"
              className="w-full"
              min={1}
            />
          </div>

          <div className="field">
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Ký hiệu: <strong>{DEFAULT_KHIEU || "(Mặc định)"}</strong>
              <br />
              Secret sẽ được tự động tính từ email người nhận, KEY_EMAIL và thời
              gian hiện tại
            </small>
          </div>

          <Button
            label={
              emailList.length > 0
                ? `Gửi Email (${emailList.length} bản ghi)`
                : "Gửi Email"
            }
            icon="pi pi-send"
            onClick={handleSendEmailMulti}
            loading={loading}
            className="p-button-primary"
            disabled={
              !type.trim() ||
              (emailList.length === 0 &&
                (!id.trim() || !nguoiNhan.trim() || !shdon))
            }
          />
        </div>
      </Card>
    </div>
  );
}
