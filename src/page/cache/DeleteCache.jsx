import React, { useState, useRef, useEffect } from "react";
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
import { Dropdown } from "primereact/dropdown";
import CryptoJS from "crypto-js";
import * as XLSX from "xlsx";
// theme
import "primereact/resources/themes/lara-light-cyan/theme.css";

const KEY_EMAIL = "6DEA50C84B9506624BE9";
const DEFAULT_KHIEU = ""; // Ký hiệu mặc định
const STORAGE_KEY_FAILED_EMAILS = "failed_emails_list"; // Key để lưu danh sách email thất bại

// Cấu hình các link và CCTBao ID tương ứng
const API_CONFIGS = [
  {
    label: "Bienlai70 (bienlai70.vpdkddtphcm.com.vn)",
    baseUrl: "http://bienlai70.vpdkddtphcm.com.vn",
    cctbaoId: "b8b04fa8-d854-428f-89f9-738191796be5",
  },
  {
    label: "SNNMTTPHCM (snnmttphcm.bienlai.com.vn)",
    baseUrl: "http://snnmttphcm.bienlai.com.vn",
    cctbaoId: "23ebeee9-d015-428d-93bd-cb3a64f7628b",
  },
];

export default function DeleteCache() {
  const [selectedApiConfig, setSelectedApiConfig] = useState(API_CONFIGS[0]); // Mặc định chọn link đầu tiên
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
    successCount: 0, // Số email gửi thành công
    failedCount: 0, // Số email gửi thất bại
    isCompleted: false, // Đã hoàn thành chưa
  });
  // Danh sách email đã gửi thất bại (lưu dạng Set để dễ check)
  const [failedEmails, setFailedEmails] = useState(new Set());
  const toast = useRef(null);
  const fileUploadRef = useRef(null);

  // Thêm state mới sau dòng 58 (sau failedEmails)
  const [hoadon68IdList, setHoadon68IdList] = useState([]);
  const [sendingById, setSendingById] = useState(false);
  const [progressById, setProgressById] = useState({
    currentBatch: 0,
    totalBatches: 0,
    currentSent: 0,
    totalCount: 0,
    percentage: 0,
    status: "",
    successCount: 0,
    failedCount: 0,
    isCompleted: false,
  });
  const fileUploadByIdRef = useRef(null);

  // Thêm state mới sau dòng 65 (sau progressById)
  const [failedEmailsById, setFailedEmailsById] = useState([]); // Danh sách email lỗi: [{email, error, hoadon68_id, batchNumber}]

  // State cho chức năng export JSON to Excel
  const [jsonItemsData, setJsonItemsData] = useState([]); // Danh sách items đã extract từ JSON
  const [processingJson, setProcessingJson] = useState(false); // Đang xử lý file JSON
  const [jsonProgress, setJsonProgress] = useState({
    status: "",
    processed: 0,
    total: 0,
    percentage: 0,
  }); // Progress khi xử lý file JSON lớn
  const fileUploadJsonRef = useRef(null);

  // Load danh sách email thất bại từ localStorage khi component mount
  useEffect(() => {
    try {
      const savedFailedEmails = localStorage.getItem(STORAGE_KEY_FAILED_EMAILS);
      if (savedFailedEmails) {
        const emailsArray = JSON.parse(savedFailedEmails);
        setFailedEmails(new Set(emailsArray));
      }
    } catch (error) {
      console.error("Error loading failed emails:", error);
    }
  }, []);

  // Tự động điền CCTBao ID khi chọn link
  useEffect(() => {
    if (selectedApiConfig) {
      setCctbaoId(selectedApiConfig.cctbaoId);
    }
  }, [selectedApiConfig]);

  // Hàm lưu danh sách email thất bại vào localStorage
  const saveFailedEmails = (emailsSet) => {
    try {
      const emailsArray = Array.from(emailsSet);
      localStorage.setItem(
        STORAGE_KEY_FAILED_EMAILS,
        JSON.stringify(emailsArray)
      );
      setFailedEmails(emailsSet);
    } catch (error) {
      console.error("Error saving failed emails:", error);
    }
  };

  // Hàm thêm email vào danh sách thất bại
  const addToFailedEmails = (email) => {
    const newFailedEmails = new Set(failedEmails);
    newFailedEmails.add(email);
    saveFailedEmails(newFailedEmails);
  };

  // Hàm xóa tất cả email thất bại
  const clearFailedEmails = () => {
    localStorage.removeItem(STORAGE_KEY_FAILED_EMAILS);
    setFailedEmails(new Set());
    toast.current.show({
      severity: "success",
      summary: "Thành công",
      detail: "Đã xóa danh sách email thất bại",
      life: 3000,
    });
  };

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
      console.log("sendEmailBatch: Không có dữ liệu để gửi email");
      return;
    }

    try {
      console.log(`sendEmailBatch: Bắt đầu gửi ${emailData.length} email`);
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

      console.log("sendEmailBatch: Payload:", JSON.stringify(payload));

      console.log("sendEmailBatch: Đang gửi request đến API...");
      const apiUrl = `${selectedApiConfig.baseUrl}/api/Invoice68/EmailMulti`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
          Referer: `${selectedApiConfig.baseUrl}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log(`sendEmailBatch: Response status: ${response.status}`);

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
          console.log(
            "sendEmailBatch: Response result:",
            JSON.stringify(result)
          );
        } else {
          throw new Error("Response rỗng");
        }
      } catch (parseError) {
        console.error("sendEmailBatch: Lỗi parse response:", parseError);
        throw new Error(`Không thể parse response: ${parseError.message}`);
      }

      if (result.code !== "00") {
        console.error(
          `sendEmailBatch: Gửi email thất bại. Code: ${result.code}, Message: ${result.message}`
        );
        // Lưu tất cả email trong batch này vào danh sách thất bại
        emailData.forEach((item) => {
          if (item.nguoi_nhan) {
            addToFailedEmails(item.nguoi_nhan);
            console.log(
              `Đã thêm email thất bại vào danh sách: ${item.nguoi_nhan}`
            );
          }
        });
        throw new Error(result.message || "Gửi email thất bại");
      }

      console.log(
        `sendEmailBatch: Gửi email thành công cho ${emailData.length} bản ghi`
      );
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
      successCount: 0,
      failedCount: 0,
      isCompleted: false,
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
      let successCount = 0; // Số email gửi thành công
      let failedCount = 0; // Số email gửi thất bại

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
              {
                columnName: "tthai",
                columnType: "nvarchar",
                value: "Đã ký",
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
            const apiUrl = `${selectedApiConfig.baseUrl}/api/Pattern/GetData`;
            response = await fetch(apiUrl, {
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
                Origin: selectedApiConfig.baseUrl,
                Pragma: "no-cache",
                Referer: `${selectedApiConfig.baseUrl}/`,
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
              },
              body: JSON.stringify(payload),
            });
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
              }))
              // Filter ra những email đã gửi thất bại trước đó
              .filter((item) => !failedEmails.has(item.nguoi_nhan));

            // Đếm số bản ghi không hợp lệ (bao gồm cả email thất bại)
            const invalidCount = result.data.length - mappedData.length;
            totalInvalidData += invalidCount;

            // Log để debug
            const skippedFailedCount = result.data.filter(
              (item) =>
                item.email &&
                item.hoadon68_id &&
                item.shdon &&
                failedEmails.has(item.email)
            ).length;
            console.log(
              `Batch ${batchNumber}: Lấy được ${result.data.length} bản ghi, ${mappedData.length} bản ghi hợp lệ (đã bỏ qua ${skippedFailedCount} email thất bại)`
            );

            if (mappedData.length === 0) {
              // Nếu không có dữ liệu hợp lệ trong batch này, kiểm tra xem còn batch khác không
              // Sử dụng totalCount đã được cập nhật hoặc result.total_count
              const currentTotalCount = totalCount || result.total_count || 0;

              // Chỉ dừng nếu:
              // 1. API trả về rỗng (result.data.length === 0) HOẶC
              // 2. Đã lấy hết (start + count >= totalCount) HOẶC
              // 3. totalCount = 0 (không có dữ liệu)
              const apiReturnedEmpty = result.data.length === 0;
              const hasReachedEnd =
                currentTotalCount > 0 && start + count >= currentTotalCount;

              if (
                apiReturnedEmpty ||
                hasReachedEnd ||
                currentTotalCount === 0
              ) {
                console.log(
                  `Batch ${batchNumber} không có dữ liệu hợp lệ và đã hết dữ liệu: apiReturnedEmpty=${apiReturnedEmpty}, hasReachedEnd=${hasReachedEnd}, currentTotalCount=${currentTotalCount}`
                );
                hasMore = false;
                break;
              } else {
                // Vẫn còn batch khác, tiếp tục
                start += count;
                batchNumber++;
                const currentBatchNum = batchNumber; // Lưu vào biến local để tránh unsafe reference
                const prevBatchNum = batchNumber - 1;
                console.log(
                  `Batch ${prevBatchNum} không có dữ liệu hợp lệ, tiếp tục batch ${currentBatchNum}...`
                );
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
              console.log(
                `Bắt đầu gửi email batch ${currentBatchForSend} với ${mappedData.length} bản ghi`
              );
              await sendEmailBatch(mappedData);
              totalSent += mappedData.length;
              successCount += mappedData.length; // Cập nhật số email thành công
              console.log(
                `Đã gửi email thành công batch ${currentBatchForSend}`
              );

              // Cập nhật tiến độ sau khi gửi thành công
              const finalTotalSent = totalSent;
              const finalTotalCount = totalCount;
              const finalBatchNum = batchNumber;
              const finalSuccessCount = successCount; // Lưu vào biến local
              const percentage =
                finalTotalCount > 0
                  ? Math.round((finalTotalSent / finalTotalCount) * 100)
                  : 0;
              setProgress((prev) => ({
                ...prev,
                currentSent: finalTotalSent,
                percentage: percentage,
                status: `Đã gửi batch ${finalBatchNum}: ${mappedData.length} hóa đơn`,
                successCount: finalSuccessCount,
              }));

              toast.current.show({
                severity: "success",
                summary: "Thành công",
                detail: `Đã gửi email batch ${batchNumber}: ${mappedData.length} hóa đơn (${totalSent}/${totalCount})`,
                life: 3000,
              });

              batchNumber++;
            } catch (emailError) {
              console.error("Error sending email batch:", emailError);
              failedCount += mappedData.length; // Cập nhật số email thất bại
              const finalFailedCount = failedCount; // Lưu vào biến local
              // Cập nhật số email thất bại
              setProgress((prev) => ({
                ...prev,
                failedCount: finalFailedCount,
              }));
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
            // Chỉ dừng khi:
            // 1. API trả về rỗng (result.data.length === 0) HOẶC
            // 2. Đã lấy hết tất cả dữ liệu (start + count >= totalCount) HOẶC
            // 3. API trả về ít hơn count VÀ đã đạt đến totalCount
            const currentTotalCount = totalCount || result.total_count || 0;
            const hasReachedEnd =
              currentTotalCount > 0 && start + count >= currentTotalCount;
            const apiReturnedEmpty = result.data.length === 0;
            const apiReturnedLessThanCount =
              result.data.length > 0 && result.data.length < count;

            // Chỉ dừng nếu:
            // - API trả về rỗng HOẶC
            // - Đã lấy hết (start + count >= totalCount) HOẶC
            // - API trả về ít hơn count VÀ đã đạt đến totalCount (batch cuối cùng)
            const shouldStop =
              apiReturnedEmpty ||
              hasReachedEnd ||
              (apiReturnedLessThanCount && hasReachedEnd);

            if (shouldStop) {
              hasMore = false;
              setProgress((prev) => ({
                ...prev,
                status: "Hoàn thành!",
              }));
              console.log(
                `Dừng vòng lặp: apiReturnedEmpty=${apiReturnedEmpty}, hasReachedEnd=${hasReachedEnd}, start=${start}, count=${count}, totalCount=${currentTotalCount}`
              );
            } else {
              start += count;
              // Cập nhật trạng thái: Đang đợi
              const nextBatchNum = batchNumber;
              setProgress((prev) => ({
                ...prev,
                status: `Đang đợi 5 giây trước batch ${nextBatchNum}...`,
              }));
              console.log(
                `Tiếp tục batch tiếp theo: start=${start}, totalCount=${currentTotalCount}, batchNumber=${nextBatchNum}`
              );
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

      // Cập nhật trạng thái hoàn thành và hiển thị tổng kết
      const totalProcessed = successCount + failedCount;
      const remainingCount = totalCount - totalProcessed;

      setProgress((prev) => ({
        ...prev,
        isCompleted: true,
        status:
          remainingCount > 0
            ? `Hoàn thành! (Còn ${remainingCount} hóa đơn chưa xử lý)`
            : "Hoàn thành!",
        successCount: successCount,
        failedCount: failedCount,
      }));

      // Thông báo hoàn thành với tổng kết
      if (totalProcessed > 0) {
        let detailMessage = `Tổng kết: Thành công ${successCount} email`;
        if (failedCount > 0) {
          detailMessage += `, Thất bại ${failedCount} email`;
        }
        if (remainingCount > 0) {
          detailMessage += `\n⚠️ Cảnh báo: Còn ${remainingCount} hóa đơn chưa được xử lý (có thể do không hợp lệ hoặc đã
                                bị filter)`;
        }
        if (totalInvalidData > 0) {
          detailMessage += `\n(${totalInvalidData} bản ghi không hợp lệ đã bỏ qua)`;
        }
        toast.current.show({
          severity: failedCount > 0 || remainingCount > 0 ? "warn" : "success",
          summary:
            remainingCount > 0 ? "Hoàn thành (Có cảnh báo)" : "Hoàn thành",
          detail: detailMessage,
          life: 10000,
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

  // Sửa lại hàm handleImportExcelByIdOnly - thêm shdon và khieu (thay thế từ dòng 923 đến 966)
  // Parse dữ liệu từ Excel - cần hoadon68_id, email, shdon, khieu
  const handleImportExcelByIdOnly = (event) => {
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (jsonData.length === 0) {
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail: "File Excel không có dữ liệu",
            life: 3000,
          });
          return;
        }

        // Parse dữ liệu từ Excel - cần hoadon68_id, email, shdon, khieu
        const parsedData = jsonData
          .map((row, index) => {
            const keys = Object.keys(row);

            // Tìm cột ID (ưu tiên theo thứ tự)
            let id = "";
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes("hoadon68_id") ||
                lowerKey.includes("hoadon68") ||
                (lowerKey.includes("id") && !lowerKey.includes("email")) ||
                keys.indexOf(key) === 0
              ) {
                id = row[key];
                break;
              }
            }
            if (!id && keys.length > 0) id = Object.values(row)[0];

            // Tìm cột Email
            let email = "";
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes("email") ||
                lowerKey.includes("nguoi") ||
                lowerKey.includes("người") ||
                keys.indexOf(key) === 1
              ) {
                email = row[key];
                break;
              }
            }
            if (!email && keys.length > 1) email = Object.values(row)[1];

            // Tìm cột Số Hóa Đơn (shdon) và đọc text trực tiếp từ cell
            let shdonColumnIndex = -1;
            let shdon = null;

            // Log để debug (chỉ log row đầu tiên)
            if (index === 0) {
              console.log("Excel columns:", keys);
            }

            // Ưu tiên tìm theo tên cột chính xác (tránh match với cột ID)
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              // Tìm cột có chứa "số hóa đơn" hoặc "shdon" nhưng KHÔNG phải cột ID
              if (
                (lowerKey.includes("số") &&
                  lowerKey.includes("hóa") &&
                  lowerKey.includes("đơn")) ||
                (lowerKey.includes("so") &&
                  lowerKey.includes("hoa") &&
                  lowerKey.includes("don")) ||
                lowerKey === "shdon" ||
                (lowerKey.includes("shdon") && !lowerKey.includes("hoadon68"))
              ) {
                // Đảm bảo không phải cột ID (không phải cột đầu tiên và không chứa "id" hoặc "hoadon68")
                const keyIndex = keys.indexOf(key);
                if (
                  keyIndex !== 0 &&
                  !lowerKey.includes("hoadon68") &&
                  !(lowerKey === "id")
                ) {
                  shdon = row[key];
                  shdonColumnIndex = keyIndex;
                  if (index === 0) {
                    console.log(
                      `Tìm thấy cột Số Hóa Đơn: "${key}" tại index ${keyIndex}`
                    );
                  }
                  break;
                }
              }
            }

            // Nếu không tìm thấy theo tên, dùng cột thứ 3 (index 2) - theo thứ tự: ID, Email, Số Hóa Đơn
            if (shdonColumnIndex === -1 && keys.length > 2) {
              shdon = Object.values(row)[2];
              shdonColumnIndex = 2;
              if (index === 0) {
                console.log(
                  `Không tìm thấy cột theo tên, dùng cột index 2 (cột thứ 3)`
                );
              }
            }

            // Đọc text trực tiếp từ cell Excel để lấy giá trị đúng
            let shdonValue = 0;
            if (shdonColumnIndex >= 0) {
              // Tìm cell address: row = index + 2 (vì có header row và index bắt đầu từ 0)
              // col = shdonColumnIndex (A=0, B=1, C=2, ...)
              const rowNum = index + 2; // +2 vì có header row (row 1) và index bắt đầu từ 0
              const cellAddress = XLSX.utils.encode_cell({
                r: rowNum,
                c: shdonColumnIndex,
              });

              // Lấy cell từ worksheet
              const cell = worksheet[cellAddress];
              if (cell) {
                // Ưu tiên lấy text từ cell (.w) - đây là giá trị hiển thị trong Excel
                // Nếu không có .w, thử lấy từ .v và convert sang string
                let cellText = null;
                if (cell.w) {
                  // .w là text value - giữ nguyên như Excel hiển thị
                  cellText = cell.w;
                } else if (cell.v !== null && cell.v !== undefined) {
                  // Nếu không có .w, dùng .v nhưng convert sang string để tránh scientific notation
                  cellText = String(cell.v);
                }

                // Log để debug (chỉ log 3 item đầu)
                if (index < 3) {
                  console.log(`Row ${rowNum}, Cell ${cellAddress}:`, {
                    cell_w: cell.w,
                    cell_v: cell.v,
                    cell_v_type: typeof cell.v,
                    cellText: cellText,
                    shdonColumnIndex: shdonColumnIndex,
                  });
                }

                if (cellText) {
                  // Loại bỏ khoảng trắng và ký tự đặc biệt, chỉ giữ số
                  const cleanText = cellText.trim().replace(/[^\d]/g, "");
                  if (cleanText) {
                    shdonValue = parseInt(cleanText, 10) || 0;
                  }
                }
              } else if (index < 3) {
                // Log nếu không tìm thấy cell
                console.warn(
                  `Không tìm thấy cell ${cellAddress} cho row ${rowNum}, column ${shdonColumnIndex}`
                );
              }
            }

            // Nếu không đọc được từ cell (shdonValue vẫn = 0), fallback về giá trị từ jsonData
            if (
              shdonValue === 0 &&
              shdon !== null &&
              shdon !== undefined &&
              shdon !== ""
            ) {
              // Nếu là string, parse trực tiếp
              if (typeof shdon === "string") {
                const cleanText = shdon.trim().replace(/[^\d]/g, "");
                if (cleanText) {
                  shdonValue = parseInt(cleanText, 10) || 0;
                }
              } else if (typeof shdon === "number") {
                // Nếu là số, kiểm tra xem có phải scientific notation không
                const shdonStr = String(shdon);
                if (shdonStr.includes("e") || shdonStr.includes("E")) {
                  // Nếu là scientific notation, không dùng vì sẽ mất độ chính xác
                  // Giữ nguyên 0 và log warning
                  console.warn(
                    `Số hóa đơn bị scientific notation: ${shdon} - không thể parse chính xác`
                  );
                } else {
                  shdonValue = shdon;
                }
              }
            }

            // Tìm cột Ký Hiệu (khieu)
            let khieu = "";
            for (const key of keys) {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes("ký") ||
                lowerKey.includes("ky") ||
                lowerKey.includes("hiệu") ||
                lowerKey.includes("hieu") ||
                lowerKey.includes("khieu") ||
                keys.indexOf(key) === 3
              ) {
                khieu = row[key];
                break;
              }
            }
            if (!khieu && keys.length > 3) khieu = Object.values(row)[3];

            return {
              id: String(id || "").trim(),
              email: String(email || "").trim(),
              shdon: shdonValue,
              khieu: String(khieu || "").trim() || DEFAULT_KHIEU,
              index: index + 1,
            };
          })
          .filter((item) => item.id && item.id.length > 0);

        if (parsedData.length === 0) {
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail:
              "Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra format: Hoadon68_ID, Email, Số Hóa Đơn, Ký Hiệu",
            life: 5000,
          });
          return;
        }

        // Thêm log để debug khi import (sau dòng 1018, trước setHoadon68IdList)
        // Log một vài record đầu để kiểm tra
        if (parsedData.length > 0) {
          console.log("=== DANH SÁCH ĐÃ IMPORT (10 item đầu tiên) ===");
          console.table(
            parsedData.slice(0, 10).map((item, idx) => ({
              STT: idx + 1,
              Hoadon68_ID: item.id,
              Email: item.email,
              "Số Hóa Đơn": item.shdon,
              "Ký Hiệu": item.khieu,
            }))
          );
          console.log(`Tổng số bản ghi: ${parsedData.length}`);
          console.log(
            `Số bản ghi có email hợp lệ: ${
              parsedData.filter(
                (item) => item.email && isValidEmail(item.email)
              ).length
            }`
          );
          console.log(
            `Số bản ghi có shdon > 0: ${
              parsedData.filter((item) => item.shdon > 0).length
            }`
          );
        }

        setHoadon68IdList(parsedData);
        toast.current.show({
          severity: "success",
          summary: "Thành công",
          detail: `Đã import ${parsedData.length} bản ghi từ file Excel (${
            parsedData.filter((item) => item.email).length
          } có email)`,
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

  // Thêm hàm validate email sau hàm calculateSecret (sau dòng 153)
  // Hàm validate email format - chỉ chấp nhận email hợp lệ
  const isValidEmail = (email) => {
    if (!email || typeof email !== "string") return false;
    const trimmedEmail = email.trim();
    // Kiểm tra email có chứa @ và có format cơ bản hợp lệ (có @ và có domain)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmedEmail);
  };

  // Sửa lại phần tạo payload trong handleSendEmailByIdOnly (thay thế từ dòng 1114 đến 1140)
  const handleSendEmailByIdOnly = async () => {
    if (!type.trim()) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng nhập Type",
        life: 3000,
      });
      return;
    }

    if (hoadon68IdList.length === 0) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng import file Excel chứa danh sách hoadon68_id",
        life: 3000,
      });
      return;
    }

    setSendingById(true);
    setLoading(true);

    // Reset progress và danh sách lỗi
    setProgressById({
      currentBatch: 0,
      totalBatches: 0,
      currentSent: 0,
      totalCount: hoadon68IdList.length,
      percentage: 0,
      status: "Đang khởi tạo...",
      successCount: 0,
      failedCount: 0,
      isCompleted: false,
    });
    setFailedEmailsById([]); // Reset danh sách lỗi khi bắt đầu mới

    try {
      const batchSize = 50; // Gửi 50 ID mỗi lần
      let allFailedIds = new Set(); // Set để lưu các hoadon68_id đã lỗi
      let allFailedEmails = new Set(); // Set để lưu các email đã lỗi
      let successCount = 0;
      let failedCount = 0;
      let currentFailedEmails = []; // Danh sách email lỗi trong session này

      // Lọc bỏ các ID/Email đã lỗi từ danh sách ban đầu
      let remainingIds = hoadon68IdList.filter(
        (item) =>
          !allFailedIds.has(item.id) &&
          (!item.email || !allFailedEmails.has(item.email.toLowerCase()))
      );
      const totalBatches = Math.ceil(remainingIds.length / batchSize);

      setProgressById((prev) => ({
        ...prev,
        totalBatches: totalBatches,
      }));

      let processedCount = 0;
      while (processedCount < remainingIds.length) {
        // Filter lại để loại bỏ các email/ID đã thất bại trong các batch trước
        const filteredRemainingIds = remainingIds.filter(
          (item) =>
            !allFailedIds.has(item.id) &&
            (!item.email || !allFailedEmails.has(item.email.toLowerCase()))
        );

        // Nếu không còn item nào, dừng vòng lặp
        if (filteredRemainingIds.length === 0) {
          console.log("Đã loại bỏ tất cả email thất bại, dừng gửi email");
          break;
        }

        // Lấy batch tiếp theo từ danh sách đã filter
        const batch = filteredRemainingIds.slice(0, batchSize);
        const batchNumber = Math.floor(processedCount / batchSize) + 1;
        currentFailedEmails = []; // Reset danh sách lỗi cho batch này

        // Cập nhật remainingIds để loại bỏ các item đã xử lý
        remainingIds = filteredRemainingIds.slice(batchSize);
        processedCount += batch.length;

        setProgressById((prev) => ({
          ...prev,
          currentBatch: batchNumber,
          status: `Đang gửi email batch ${batchNumber}/${totalBatches}...`,
        }));

        try {
          // Filter bỏ các record không có email hợp lệ
          const validBatch = batch.filter((item) => {
            if (!item.email || !isValidEmail(item.email)) {
              // Lưu vào danh sách lỗi
              const failedEmail = {
                email: item.email || "N/A",
                error: "Email không hợp lệ hoặc không phải định dạng email",
                hoadon68_id: item.id,
                batchNumber: batchNumber,
              };
              currentFailedEmails.push(failedEmail);
              allFailedIds.add(item.id);
              if (item.email) {
                allFailedEmails.add(item.email.toLowerCase());
              }
              return false;
            }
            return true;
          });

          // Nếu không còn record hợp lệ nào trong batch, bỏ qua batch này
          if (validBatch.length === 0) {
            console.log(`Batch ${batchNumber}: Không có email hợp lệ, bỏ qua`);
            failedCount += batch.length;
            setFailedEmailsById((prev) => [...prev, ...currentFailedEmails]);
            setProgressById((prev) => ({
              ...prev,
              failedCount: failedCount,
              status: `Batch ${batchNumber}: Tất cả email không hợp lệ, đã bỏ qua`,
            }));
            continue; // Bỏ qua batch này
          }

          // Tạo payload đầy đủ với id, nguoi_nhan, shdon, khieu, scret - chỉ với email hợp lệ
          const emailPayload = validBatch.map((item) => {
            // Tính secret từ email
            const scret = calculateSecret(item.email);

            // Sửa lại phần tạo payload (thay thế từ dòng 1210 đến 1214)
            // Đảm bảo shdon là số nguyên, không phải scientific notation
            let shdonValue = 0;
            if (
              item.shdon !== null &&
              item.shdon !== undefined &&
              item.shdon !== ""
            ) {
              if (typeof item.shdon === "number") {
                // Kiểm tra xem có phải scientific notation không
                const shdonStr = item.shdon.toString();
                if (shdonStr.includes("e") || shdonStr.includes("E")) {
                  // Nếu là scientific notation, lấy phần nguyên
                  shdonValue = Math.floor(item.shdon);
                } else {
                  // Nếu là số bình thường, lấy phần nguyên
                  shdonValue = Math.floor(item.shdon);
                }
              } else {
                // Nếu là string, xử lý
                const shdonStr = String(item.shdon).trim();
                // Kiểm tra xem có phải scientific notation không
                if (shdonStr.includes("e") || shdonStr.includes("E")) {
                  // Parse scientific notation về số rồi lấy phần nguyên
                  const numValue = parseFloat(shdonStr);
                  if (!isNaN(numValue)) {
                    shdonValue = Math.floor(numValue);
                  }
                } else {
                  // Nếu không phải scientific notation, loại bỏ ký tự không phải số
                  const shdonClean = shdonStr.replace(/[^\d]/g, "");
                  if (shdonClean) {
                    shdonValue = parseInt(shdonClean, 10) || 0;
                  }
                }
              }
            }

            const payloadItem = {
              id: String(item.id),
              nguoi_nhan: String(item.email.trim()),
              shdon: shdonValue, // Sử dụng giá trị đã xử lý
              khieu: String(item.khieu || DEFAULT_KHIEU),
              scret: String(scret),
            };

            return payloadItem;
          });

          const payload = {
            id: emailPayload,
            type: String(type.trim()),
          };

          console.log(
            `Batch ${batchNumber}: Gửi ${validBatch.length} email hợp lệ (${
              batch.length - validBatch.length
            } bị loại bỏ do email không hợp lệ)`
          );
          console.log(`Payload:`, JSON.stringify(payload, null, 2));

          const apiUrl = `${selectedApiConfig.baseUrl}/api/Invoice68/EmailMulti`;
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              Authorization:
                "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
              Referer: `${selectedApiConfig.baseUrl}/`,
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
          }

          const result = await response.json();
          console.log(`Batch ${batchNumber} Result:`, result);

          if (result.code === "00") {
            // Kiểm tra xem có email thất bại trong result.data không
            let failedEmailsFromResponse = [];
            let successCountInBatch = validBatch.length;

            if (result.data && Array.isArray(result.data)) {
              // Duyệt qua từng item trong result.data để tìm các email thất bại (code: "99")
              result.data.forEach((responseItem) => {
                if (responseItem.code === "99" && responseItem.message) {
                  // Trích xuất email từ message
                  // Format: "Địa chỉ email 'email@example.com' không thể nhận được email"
                  // hoặc "Địa chỉ email người nhận 'email@example.com' không đúng định dạng."
                  const emailMatch =
                    responseItem.message.match(/'([^']+@[^']+)'/);
                  if (emailMatch && emailMatch[1]) {
                    const failedEmail = emailMatch[1].toLowerCase();
                    failedEmailsFromResponse.push({
                      email: failedEmail,
                      error: responseItem.message,
                    });

                    // Tìm item tương ứng trong validBatch
                    const correspondingItem = validBatch.find(
                      (item) => item.email.toLowerCase() === failedEmail
                    );

                    if (correspondingItem) {
                      // Thêm vào danh sách lỗi
                      const failedEmailRecord = {
                        email: correspondingItem.email,
                        error: responseItem.message,
                        hoadon68_id: correspondingItem.id,
                        batchNumber: batchNumber,
                      };
                      currentFailedEmails.push(failedEmailRecord);
                      allFailedIds.add(correspondingItem.id);
                      allFailedEmails.add(failedEmail);

                      // Giảm số lượng thành công
                      successCountInBatch--;
                    }
                  }
                }
              });
            }

            // Cập nhật số lượng thành công và thất bại
            successCount += successCountInBatch;
            failedCount +=
              batch.length -
              validBatch.length +
              failedEmailsFromResponse.length;

            // Cập nhật danh sách email lỗi nếu có
            if (currentFailedEmails.length > 0) {
              setFailedEmailsById((prev) => [...prev, ...currentFailedEmails]);
            }

            const detailMessage =
              failedEmailsFromResponse.length > 0
                ? `Đã gửi email batch ${batchNumber}: ${successCountInBatch} thành công, ${
                    failedEmailsFromResponse.length
                  } thất bại (${
                    batch.length - validBatch.length
                  } bị loại bỏ do email không hợp lệ)`
                : `Đã gửi email batch ${batchNumber}: ${
                    validBatch.length
                  } hóa đơn (${
                    batch.length - validBatch.length
                  } bị loại bỏ do email không hợp lệ)`;

            toast.current.show({
              severity:
                failedEmailsFromResponse.length > 0 ? "warn" : "success",
              summary:
                failedEmailsFromResponse.length > 0
                  ? "Thành công (có cảnh báo)"
                  : "Thành công",
              detail: detailMessage,
              life: 3000,
            });
          } else {
            // Xử lý lỗi - lưu tất cả record trong validBatch vào danh sách lỗi
            const errorMessage = result.message || "Gửi email thất bại";

            validBatch.forEach((item) => {
              const failedEmail = {
                email: item.email,
                error: errorMessage,
                hoadon68_id: item.id,
                batchNumber: batchNumber,
              };
              currentFailedEmails.push(failedEmail);
              allFailedIds.add(item.id);
              allFailedEmails.add(item.email.toLowerCase());
            });

            failedCount += validBatch.length;

            // Cập nhật danh sách email lỗi
            setFailedEmailsById((prev) => [...prev, ...currentFailedEmails]);

            toast.current.show({
              severity: "error",
              summary: "Lỗi gửi email",
              detail: `Lỗi batch ${batchNumber}: ${errorMessage}`,
              life: 5000,
            });
          }

          // Cập nhật tiến độ với số lượng hợp lệ
          const currentSent = processedCount;
          const totalToProcess = hoadon68IdList.length;
          const percentage = Math.round((currentSent / totalToProcess) * 100);
          setProgressById((prev) => ({
            ...prev,
            currentSent: currentSent,
            percentage: percentage,
            successCount: successCount,
            failedCount: failedCount,
            status: `Đã gửi batch ${batchNumber}: ${validBatch.length} hóa đơn`,
          }));

          // Đợi 2 giây trước khi gửi batch tiếp theo (trừ batch cuối)
          if (remainingIds.length > 0) {
            setProgressById((prev) => ({
              ...prev,
              status: `Đang đợi 2 giây trước batch ${batchNumber + 1}...`,
            }));
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Error sending batch ${batchNumber}:`, error);

          // Lưu tất cả ID trong batch này là lỗi
          const errorMessage = error.message || "Lỗi không xác định";
          batch.forEach((item) => {
            const failedEmail = {
              email: item.email || "N/A (Lỗi batch)",
              error: errorMessage,
              hoadon68_id: item.id,
              batchNumber: batchNumber,
            };
            currentFailedEmails.push(failedEmail);
            allFailedIds.add(item.id);
            if (item.email) {
              allFailedEmails.add(item.email.toLowerCase());
            }
          });

          failedCount += batch.length;

          // Cập nhật danh sách email lỗi
          setFailedEmailsById((prev) => [...prev, ...currentFailedEmails]);

          setProgressById((prev) => ({
            ...prev,
            failedCount: failedCount,
          }));
          toast.current.show({
            severity: "error",
            summary: "Lỗi gửi email",
            detail: `Lỗi khi gửi email batch ${batchNumber}: ${error.message}`,
            life: 5000,
          });
          // Tiếp tục với batch tiếp theo dù có lỗi
        }
      }

      // Hoàn thành
      setProgressById((prev) => ({
        ...prev,
        isCompleted: true,
        status: "Hoàn thành!",
      }));

      toast.current.show({
        severity: successCount > 0 ? "success" : "warn",
        summary: "Hoàn thành",
        detail: `Tổng kết: Thành công ${successCount} email, Thất bại ${failedCount} email`,
        life: 5000,
      });
    } catch (error) {
      console.error("Error sending emails:", error);
      setProgressById((prev) => ({
        ...prev,
        status: `Lỗi: ${error.message || "Có lỗi xảy ra"}`,
      }));
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: error.message || "Có lỗi xảy ra khi gửi email",
        life: 3000,
      });
    } finally {
      setSendingById(false);
      setLoading(false);
    }
  };

  // Sửa lại hàm handleDownloadTemplateById (thay thế từ dòng 1195)
  const handleDownloadTemplateById = () => {
    try {
      const sampleData = [
        {
          Hoadon68_ID: "41b1df2f-7d4f-4ec0-9fbd-fc8fde4cc233",
          Email: "example1@email.com",
          "Số Hóa Đơn": 171486,
          "Ký Hiệu": "EBL01-25T",
        },
        {
          Hoadon68_ID: "abc123-def456-ghi789",
          Email: "example2@email.com",
          "Số Hóa Đơn": 171481,
          "Ký Hiệu": "EBL01-25T",
        },
        {
          Hoadon68_ID: "xyz789-uvw456-rst123",
          Email: "example3@email.com",
          "Số Hóa Đơn": 171462,
          "Ký Hiệu": "EBL01-25T",
        },
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sampleData);

      ws["!cols"] = [
        { wch: 40 }, // Hoadon68_ID
        { wch: 30 }, // Email
        { wch: 15 }, // Số Hóa Đơn
        { wch: 15 }, // Ký Hiệu
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Mẫu");

      const fileName = `Mau_File_Hoadon68_ID_${new Date().getTime()}.xlsx`;
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

  // Hàm xử lý upload file JSON với hỗ trợ file lớn
  const handleImportJson = (event) => {
    const file = event.files[0];
    if (!file) {
      return;
    }

    // Hiển thị thông báo file lớn
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (file.size > 50 * 1024 * 1024) {
      toast.current.show({
        severity: "info",
        summary: "Thông báo",
        detail: `File lớn (${fileSizeMB}MB). Đang xử lý, vui lòng đợi...`,
        life: 5000,
      });
    }

    setProcessingJson(true);
    setJsonProgress({
      status: "Đang đọc file...",
      processed: 0,
      total: 0,
      percentage: 0,
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setJsonProgress({
          status: "Đang parse JSON...",
          processed: 0,
          total: 0,
          percentage: 10,
        });

        const jsonText = e.target.result;
        let jsonData;

        // Parse JSON - có thể là array hoặc object
        try {
          jsonData = JSON.parse(jsonText);
        } catch (parseError) {
          setProcessingJson(false);
          toast.current.show({
            severity: "error",
            summary: "Lỗi",
            detail: "File JSON không hợp lệ. Vui lòng kiểm tra lại.",
            life: 5000,
          });
          return;
        }

        // Chuyển đổi thành array nếu là object đơn
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        const totalOrders = dataArray.length;

        setJsonProgress({
          status: `Đang xử lý ${totalOrders} orders...`,
          processed: 0,
          total: totalOrders,
          percentage: 20,
        });

        // Extract items từ mỗi order - xử lý theo batch để không block UI
        const extractedItems = [];
        const BATCH_SIZE = 100; // Xử lý 100 orders mỗi batch

        const processBatch = async (startIndex) => {
          const endIndex = Math.min(startIndex + BATCH_SIZE, totalOrders);

          for (let i = startIndex; i < endIndex; i++) {
            const order = dataArray[i];

            // Lấy order_number từ order
            const orderNumber = order.order_number || order.order_id || "";

            // Ưu tiên lấy từ raw_data.line_items (dữ liệu gốc từ TikTok)
            if (
              order &&
              order.raw_data &&
              order.raw_data.line_items &&
              Array.isArray(order.raw_data.line_items)
            ) {
              order.raw_data.line_items.forEach((lineItem) => {
                extractedItems.push({
                  order_number: String(orderNumber),
                  item_id: String(lineItem.id || ""),
                  item_sku: lineItem.seller_sku || "",
                  item_name: lineItem.product_name || "",
                });
              });
            }
            // Fallback: lấy từ items array nếu không có raw_data.line_items
            else if (order && order.items && Array.isArray(order.items)) {
              order.items.forEach((item) => {
                extractedItems.push({
                  order_number: String(orderNumber),
                  item_id: String(item.item_id || ""),
                  item_sku: item.item_sku || "",
                  item_name: item.item_name || "",
                });
              });
            }

            // Cập nhật progress
            const processed = i + 1;
            const percentage = 20 + Math.floor((processed / totalOrders) * 70);
            setJsonProgress({
              status: `Đang xử lý order ${processed}/${totalOrders}...`,
              processed: processed,
              total: totalOrders,
              percentage: percentage,
            });
          }

          // Nếu còn orders, tiếp tục xử lý batch tiếp theo
          if (endIndex < totalOrders) {
            // Sử dụng setTimeout để cho phép browser render và không block UI
            await new Promise((resolve) => setTimeout(resolve, 0));
            await processBatch(endIndex);
          }
        };

        // Bắt đầu xử lý từ index 0
        await processBatch(0);

        setJsonProgress({
          status: "Hoàn thành!",
          processed: totalOrders,
          total: totalOrders,
          percentage: 100,
        });

        if (extractedItems.length === 0) {
          setProcessingJson(false);
          toast.current.show({
            severity: "warn",
            summary: "Cảnh báo",
            detail:
              "Không tìm thấy items nào trong file JSON. Vui lòng kiểm tra cấu trúc dữ liệu.",
            life: 5000,
          });
          return;
        }

        setJsonItemsData(extractedItems);
        setProcessingJson(false);
        toast.current.show({
          severity: "success",
          summary: "Thành công",
          detail: `Đã import ${extractedItems.length} items từ ${totalOrders} order(s)`,
          life: 5000,
        });
      } catch (error) {
        console.error("Error parsing JSON:", error);
        setProcessingJson(false);
        toast.current.show({
          severity: "error",
          summary: "Lỗi",
          detail: `Có lỗi xảy ra khi đọc file JSON: ${error.message}`,
          life: 5000,
        });
      }
    };

    reader.onerror = () => {
      setProcessingJson(false);
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: "Có lỗi xảy ra khi đọc file",
        life: 5000,
      });
    };

    reader.readAsText(file);
  };

  // Hàm export Excel từ JSON items
  const handleExportJsonToExcel = () => {
    if (!jsonItemsData || jsonItemsData.length === 0) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail:
          "Không có dữ liệu để xuất Excel. Vui lòng import file JSON trước.",
        life: 3000,
      });
      return;
    }

    try {
      // Tạo workbook và worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(jsonItemsData);

      // Đặt độ rộng cột
      ws["!cols"] = [
        { wch: 20 }, // order_number
        { wch: 20 }, // item_id
        { wch: 15 }, // item_sku
        { wch: 50 }, // item_name
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Items");

      // Tạo tên file với timestamp
      const fileName = `Items_Export_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.current.show({
        severity: "success",
        summary: "Thành công",
        detail: `Đã xuất ${jsonItemsData.length} items ra file Excel`,
        life: 3000,
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: "Có lỗi xảy ra khi xuất file Excel",
        life: 3000,
      });
    }
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

      const apiUrl = `${selectedApiConfig.baseUrl}/api/Invoice68/EmailMulti`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
          Referer: `${selectedApiConfig.baseUrl}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

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
        // Không xóa CCTBao ID, giữ lại giá trị từ selectedApiConfig
        setCctbaoId(selectedApiConfig.cctbaoId);
        if (fileUploadRef.current) {
          fileUploadRef.current.clear();
        }
      } else {
        // Lưu tất cả email trong batch này vào danh sách thất bại
        emailData.forEach((item) => {
          if (item.nguoi_nhan) {
            addToFailedEmails(item.nguoi_nhan);
            console.log(
              `Đã thêm email thất bại vào danh sách: ${item.nguoi_nhan}`
            );
          }
        });
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
            <label htmlFor="apiConfig" className="font-bold">
              Chọn Link API <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="apiConfig"
              value={selectedApiConfig}
              options={API_CONFIGS}
              onChange={(e) => setSelectedApiConfig(e.value)}
              optionLabel="label"
              placeholder="Chọn link API"
              className="w-full"
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              CCTBao ID sẽ tự động điền khi chọn link
            </small>
          </div>

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
          {((fetchingData || loading) && progress.totalCount > 0) ||
          progress.isCompleted ? (
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

                {/* Hiển thị tổng kết khi hoàn thành */}
                {progress.isCompleted && (
                  <div className="p-3 border-1 border-200 border-round bg-green-50">
                    <div className="flex flex-column gap-2">
                      <div className="flex align-items-center gap-2">
                        <i className="pi pi-check-circle text-green-600"></i>
                        <span className="font-bold text-lg">
                          Tổng kết kết quả:
                        </span>
                      </div>
                      <div className="grid">
                        <div className="col-12 md:col-6">
                          <div className="flex flex-column">
                            <span className="text-600 text-sm mb-1">
                              Thành công
                            </span>
                            <span className="font-bold text-xl text-green-600">
                              {progress.successCount} email
                            </span>
                          </div>
                        </div>
                        <div className="col-12 md:col-6">
                          <div className="flex flex-column">
                            <span className="text-600 text-sm mb-1">
                              Thất bại
                            </span>
                            <span className="font-bold text-xl text-red-600">
                              {progress.failedCount} email
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-600 text-sm">
                          Tổng cộng đã xử lý:{" "}
                          <strong>
                            {progress.successCount + progress.failedCount} email
                          </strong>
                        </span>
                        {progress.totalCount > 0 &&
                          progress.totalCount >
                            progress.successCount + progress.failedCount && (
                            <div className="mt-2 p-2 border-1 border-200 border-round bg-yellow-50">
                              <span className="text-600 text-sm">
                                <i className="pi pi-exclamation-triangle text-yellow-600 mr-1"></i>
                                Còn lại:{" "}
                                <strong className="text-yellow-700">
                                  {progress.totalCount -
                                    (progress.successCount +
                                      progress.failedCount)}{" "}
                                  hóa đơn
                                </strong>{" "}
                                chưa được xử lý (có thể do không hợp lệ hoặc đã
                                bị filter)
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-2 border-1 border-200 border-round bg-blue-50">
                  <small className="text-600">
                    <i className="pi pi-info-circle mr-1"></i>
                    {progress.status}
                  </small>
                </div>
              </div>
            </Panel>
          ) : null}

          {/* Hiển thị danh sách email thất bại */}
          {failedEmails.size > 0 && (
            <Panel
              header={
                <div className="flex justify-content-between align-items-center w-full">
                  <span>
                    Danh sách Email Thất Bại ({failedEmails.size} email)
                  </span>
                  <Button
                    label="Xóa Danh Sách"
                    icon="pi pi-trash"
                    onClick={clearFailedEmails}
                    className="p-button-danger p-button-sm"
                    size="small"
                  />
                </div>
              }
              className="mb-3"
            >
              <div className="flex flex-column gap-2">
                <div className="p-2 border-1 border-200 border-round bg-red-50">
                  <small className="text-600">
                    <i className="pi pi-exclamation-triangle mr-1"></i>
                    Các email này đã gửi thất bại trước đó và sẽ được bỏ qua khi
                    lấy dữ liệu tự động
                  </small>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(failedEmails).map((email, index) => (
                    <span
                      key={index}
                      className="p-2 border-1 border-200 border-round bg-white"
                      style={{ fontSize: "0.875rem" }}
                    >
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          )}

          {/* <div className="flex align-items-center gap-2">
            <div className="flex-1 border-top-1 border-300"></div>
            <span className="text-600">HOẶC</span>
            <div className="flex-1 border-top-1 border-300"></div>
          </div> */}

          {/* <div className="field">
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
          </div> */}

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

          {/* <div className="flex align-items-center gap-2">
            <div className="flex-1 border-top-1 border-300"></div>
            <span className="text-600">HOẶC</span>
            <div className="flex-1 border-top-1 border-300"></div>
          </div> */}

          {/* <div className="field">
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
          </div> */}

          {/* <div className="field">
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Ký hiệu: <strong>{DEFAULT_KHIEU || "(Mặc định)"}</strong>
              <br />
              Secret sẽ được tự động tính từ email người nhận, KEY_EMAIL và thời
              gian hiện tại
            </small>
          </div> */}

          {/* <Button
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
          /> */}
        </div>
      </Card>

      <Card title="Gửi Email theo Hoadon68_ID (Import Excel)" className="mb-4">
        <div className="flex flex-column gap-4">
          <div className="field">
            <label htmlFor="apiConfigById" className="font-bold">
              Chọn Link API <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="apiConfigById"
              value={selectedApiConfig}
              options={API_CONFIGS}
              onChange={(e) => setSelectedApiConfig(e.value)}
              optionLabel="label"
              placeholder="Chọn link API"
              className="w-full"
            />
          </div>

          <div className="field">
            <label htmlFor="typeById" className="font-bold">
              Type <span className="text-red-500">*</span>
            </label>
            <InputText
              id="typeById"
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
            <div className="flex justify-content-between align-items-center mb-2">
              <label className="font-bold m-0">
                Import File Excel (Chỉ Hoadon68_ID)
              </label>
              <Button
                label="Tải File Mẫu"
                icon="pi pi-download"
                onClick={handleDownloadTemplateById}
                className="p-button-outlined p-button-secondary"
                size="small"
              />
            </div>
            <FileUpload
              ref={fileUploadByIdRef}
              name="excelFileById"
              accept=".xlsx,.xls"
              maxFileSize={10000000}
              customUpload
              uploadHandler={handleImportExcelByIdOnly}
              auto
              chooseLabel="Chọn File Excel"
              className="w-full"
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Format file Excel: Cột 1 = Hoadon68_ID (bắt buộc), Cột 2 = Email
              (bắt buộc), Cột 3 = Số Hóa Đơn (bắt buộc), Cột 4 = Ký Hiệu (mặc
              định: {DEFAULT_KHIEU || "EBL01-25T"})
              <br />
              Secret sẽ được tự động tính từ email
              <br />
              Gửi theo batch: 50 ID mỗi lần, đợi 2 giây giữa các batch
            </small>
          </div>

          {/* Hiển thị tiến độ */}
          {(sendingById || loading) && progressById.totalCount > 0 ? (
            <Panel header="Tiến độ xử lý" className="mb-3">
              <div className="flex flex-column gap-3">
                <div>
                  <div className="flex justify-content-between align-items-center mb-2">
                    <span className="font-bold">{progressById.status}</span>
                    <span className="text-600">{progressById.percentage}%</span>
                  </div>
                  <ProgressBar value={progressById.percentage} />
                </div>

                <div className="grid">
                  <div className="col-12 md:col-6">
                    <div className="flex flex-column">
                      <span className="text-600 text-sm mb-1">
                        Batch hiện tại
                      </span>
                      <span className="font-bold text-lg">
                        {progressById.currentBatch} /{" "}
                        {progressById.totalBatches}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="flex flex-column">
                      <span className="text-600 text-sm mb-1">Đã gửi</span>
                      <span className="font-bold text-lg">
                        {progressById.currentSent} / {progressById.totalCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hiển thị tổng kết khi hoàn thành */}
                {progressById.isCompleted && (
                  <div className="p-3 border-1 border-200 border-round bg-green-50">
                    <div className="flex flex-column gap-2">
                      <div className="flex align-items-center gap-2">
                        <i className="pi pi-check-circle text-green-600"></i>
                        <span className="font-bold text-lg">
                          Tổng kết kết quả:
                        </span>
                      </div>
                      <div className="grid">
                        <div className="col-12 md:col-6">
                          <div className="flex flex-column">
                            <span className="text-600 text-sm mb-1">
                              Thành công
                            </span>
                            <span className="font-bold text-xl text-green-600">
                              {progressById.successCount} email
                            </span>
                          </div>
                        </div>
                        <div className="col-12 md:col-6">
                          <div className="flex flex-column">
                            <span className="text-600 text-sm mb-1">
                              Thất bại
                            </span>
                            <span className="font-bold text-xl text-red-600">
                              {progressById.failedCount} email
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          ) : null}

          {hoadon68IdList.length > 0 && (
            <div className="field">
              <label className="font-bold">
                Danh sách đã import ({hoadon68IdList.length} hoadon68_id)
              </label>
              <DataTable
                value={hoadon68IdList}
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 20, 50]}
                className="p-datatable-sm"
              >
                <Column field="index" header="STT" style={{ width: "5rem" }} />
                <Column field="id" header="Hoadon68_ID" />
              </DataTable>
            </div>
          )}

          <Button
            label={
              hoadon68IdList.length > 0
                ? `Gửi Email (${hoadon68IdList.length} hóa đơn - 50/batch)`
                : "Gửi Email"
            }
            icon="pi pi-send"
            onClick={handleSendEmailByIdOnly}
            loading={sendingById || loading}
            className="p-button-primary"
            disabled={!type.trim() || hoadon68IdList.length === 0}
          />
        </div>
      </Card>

      {/* Hiển thị danh sách email lỗi */}
      {failedEmailsById.length > 0 && (
        <Panel
          header={
            <div className="flex justify-content-between align-items-center w-full">
              <span>Danh sách Email Lỗi ({failedEmailsById.length} email)</span>
              <Button
                label="Xóa Danh Sách"
                icon="pi pi-trash"
                onClick={() => setFailedEmailsById([])}
                className="p-button-danger p-button-sm"
                size="small"
              />
            </div>
          }
          className="mb-3"
        >
          <div className="flex flex-column gap-2">
            <div className="p-2 border-1 border-200 border-round bg-red-50">
              <small className="text-600">
                <i className="pi pi-exclamation-triangle mr-1"></i>
                Các email này đã gửi lỗi ở các batch trước và đã được loại trừ
                khỏi batch tiếp theo
              </small>
            </div>
            <DataTable
              value={failedEmailsById}
              paginator
              rows={10}
              rowsPerPageOptions={[5, 10, 20, 50]}
              className="p-datatable-sm"
            >
              <Column
                field="batchNumber"
                header="Batch"
                style={{ width: "5rem" }}
              />
              <Column field="hoadon68_id" header="Hoadon68_ID" />
              <Column field="email" header="Email" />
              <Column
                field="error"
                header="Lỗi"
                body={(rowData) => (
                  <span className="text-red-600">{rowData.error}</span>
                )}
              />
            </DataTable>
          </div>
        </Panel>
      )}

      {/* Hiển thị danh sách đã import (10 item đầu) */}
      {hoadon68IdList.length > 0 && (
        <Panel
          header={`Danh sách đã import (${hoadon68IdList.length} bản ghi) - Xem 10 item đầu`}
          className="mb-3"
        >
          <div className="flex flex-column gap-2">
            <DataTable
              value={hoadon68IdList.slice(0, 10)}
              className="p-datatable-sm"
              stripedRows
            >
              <Column field="index" header="STT" style={{ width: "5rem" }} />
              <Column
                field="id"
                header="Hoadon68_ID"
                style={{ minWidth: "250px" }}
              />
              <Column
                field="email"
                header="Email"
                style={{ minWidth: "200px" }}
                body={(rowData) => (
                  <span
                    className={
                      !isValidEmail(rowData.email) ? "text-red-600" : ""
                    }
                  >
                    {rowData.email || "N/A"}
                    {!isValidEmail(rowData.email) && (
                      <i
                        className="pi pi-exclamation-triangle ml-2 text-red-600"
                        title="Email không hợp lệ"
                      ></i>
                    )}
                  </span>
                )}
              />
              <Column
                field="shdon"
                header="Số Hóa Đơn"
                style={{ width: "120px" }}
                body={(rowData) => (
                  <span className={rowData.shdon === 0 ? "text-red-600" : ""}>
                    {rowData.shdon || 0}
                    {rowData.shdon === 0 && (
                      <i
                        className="pi pi-exclamation-triangle ml-2 text-red-600"
                        title="Số hóa đơn = 0"
                      ></i>
                    )}
                  </span>
                )}
              />
              <Column
                field="khieu"
                header="Ký Hiệu"
                style={{ width: "120px" }}
              />
            </DataTable>
            {hoadon68IdList.length > 10 && (
              <div className="p-2 border-1 border-200 border-round bg-blue-50">
                <small className="text-600">
                  <i className="pi pi-info-circle mr-1"></i>
                  Chỉ hiển thị 10 item đầu tiên. Tổng cộng{" "}
                  {hoadon68IdList.length} bản ghi.
                  <br />
                  Mở Console (F12) để xem chi tiết 10 item đầu.
                </small>
              </div>
            )}
            <div className="p-2 border-1 border-200 border-round bg-yellow-50">
              <small className="text-600">
                <i className="pi pi-info-circle mr-1"></i>
                <strong>Thống kê:</strong> Email hợp lệ:{" "}
                {
                  hoadon68IdList.filter(
                    (item) => item.email && isValidEmail(item.email)
                  ).length
                }{" "}
                / {hoadon68IdList.length} | Số Hóa Đơn &gt; 0:{" "}
                {hoadon68IdList.filter((item) => item.shdon > 0).length} /{" "}
                {hoadon68IdList.length}
              </small>
            </div>
          </div>
        </Panel>
      )}

      {/* Card mới: Export JSON to Excel */}
      <Card title="Xuất Excel từ JSON" className="mb-4">
        <div className="flex flex-column gap-4">
          <div className="field">
            <label className="font-bold m-0">
              Import File JSON <span className="text-red-500">*</span>
            </label>
            <FileUpload
              ref={fileUploadJsonRef}
              name="jsonFile"
              accept=".json"
              maxFileSize={500000000}
              customUpload
              uploadHandler={handleImportJson}
              auto
              chooseLabel="Chọn File JSON"
              className="w-full"
              disabled={processingJson}
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              File JSON có thể là array hoặc object đơn. Hệ thống sẽ tự động
              extract items từ mỗi order. Hỗ trợ file lớn (tối đa 500MB).
              <br />
              Cấu trúc: mỗi order có mảng "items" chứa item_id, item_sku,
              item_name
            </small>
          </div>

          {/* Progress bar khi đang xử lý file lớn */}
          {processingJson && (
            <Panel header="Đang xử lý file JSON" className="mb-3">
              <div className="flex flex-column gap-3">
                <div>
                  <div className="flex justify-content-between align-items-center mb-2">
                    <span className="font-bold">{jsonProgress.status}</span>
                    <span className="text-600">{jsonProgress.percentage}%</span>
                  </div>
                  <ProgressBar value={jsonProgress.percentage} />
                </div>
                {jsonProgress.total > 0 && (
                  <div className="p-2 border-1 border-200 border-round bg-blue-50">
                    <small className="text-600">
                      <i className="pi pi-info-circle mr-1"></i>
                      Đã xử lý: {jsonProgress.processed} / {jsonProgress.total}{" "}
                      orders
                    </small>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {jsonItemsData.length > 0 && (
            <div className="field">
              <div className="flex justify-content-between align-items-center mb-2">
                <label className="font-bold m-0">
                  Dữ liệu đã import ({jsonItemsData.length} items)
                </label>
                <Button
                  label="Xuất Excel"
                  icon="pi pi-file-excel"
                  onClick={handleExportJsonToExcel}
                  className="p-button-success"
                />
              </div>
              <DataTable
                value={jsonItemsData}
                paginator={jsonItemsData.length > 10}
                rows={10}
                rowsPerPageOptions={[5, 10, 20, 50]}
                className="p-datatable-sm"
              >
                <Column
                  field="order_number"
                  header="Số Đơn Hàng"
                  style={{ width: "180px" }}
                />
                <Column
                  field="item_id"
                  header="Mã Hàng"
                  style={{ width: "200px" }}
                />
                <Column
                  field="item_sku"
                  header="Mã SKU"
                  style={{ width: "150px" }}
                />
                <Column
                  field="item_name"
                  header="Tên Sản Phẩm"
                  style={{ minWidth: "300px" }}
                />
              </DataTable>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
