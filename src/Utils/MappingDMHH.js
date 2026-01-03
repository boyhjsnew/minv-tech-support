import * as XLSX from "xlsx";
import uploadProductExcel from "./UploadProductExcel.js";

let excelData = []; // Biến lưu trữ dữ liệu đã mapping
let currentTaxCode = null; // Lưu taxCode hiện tại

/**
 * Map dữ liệu hàng hóa từ API sang format Excel
 * @param {Array} productArray - Mảng dữ liệu hàng hóa từ API
 * @returns {Array} - Mảng dữ liệu đã được mapping
 */
const mapProductDataAsync = async (productArray) => {
  excelData = productArray.map((data) => {
    // Mapping các trường từ API response sang format Excel
    // Dựa trên cấu trúc thực tế: ma_hv, ten_hv, ma_dvt, gia_ban, pt_thue/ma_thue
    return {
      "Mã hàng hóa *": data.ma_hv || "",
      "Tên hàng hóa *": data.ten_hv || "",
      "Đơn vị tính": data.ma_dvt || "",
      "Đơn giá": data.gia_ban !== null && data.gia_ban !== undefined ? data.gia_ban : 0,
      "Thuế suất thuế GTGT": data.pt_thue !== null && data.pt_thue !== undefined ? data.pt_thue : (data.ma_thue || 0),
    };
  });

  return excelData; // Trả về dữ liệu đã mapping
};

/**
 * Upload file Excel lên 2.0 (không tải về máy)
 * Browser sẽ tự động gửi cookies theo domain (vì đã đăng nhập)
 * @param {string} taxCode - Mã số thuế
 * @param {Function} onUploadComplete - Callback khi upload xong
 */
const uploadExcelToServer = async (taxCode = null, onUploadComplete = null) => {
  if (excelData.length === 0) {
    if (onUploadComplete) {
      onUploadComplete({ success: false, message: "Chưa có dữ liệu hàng hóa!" });
    }
    return;
  }

  const taxCodeToUse = taxCode || currentTaxCode;
  if (!taxCodeToUse) {
    if (onUploadComplete) {
      onUploadComplete({ success: false, message: "Chưa có mã số thuế!" });
    }
    return;
  }

  try {
    // Tạo workbook và worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Thêm sheet vào workbook
    XLSX.utils.book_append_sheet(wb, ws, "HangHoa");

    // Tạo file Excel trong memory (không download)
    const fileName = "DanhSachHangHoa.xlsx";
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new File([excelBuffer], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    console.log("📤 Đang upload file Excel hàng hóa lên 2.0...");
    const uploadResult = await uploadProductExcel(file, taxCodeToUse);

    if (uploadResult.success) {
      console.log("✅ Upload thành công:", uploadResult.data);
      if (onUploadComplete) {
        onUploadComplete({ success: true, message: uploadResult.message, data: uploadResult.data });
      }
    } else {
      console.error("❌ Upload thất bại:", uploadResult.error);
      if (onUploadComplete) {
        onUploadComplete({ success: false, message: uploadResult.message, error: uploadResult.error });
      }
    }
  } catch (error) {
    console.error("❌ Lỗi khi upload:", error);
    if (onUploadComplete) {
      onUploadComplete({ success: false, message: error.message, error });
    }
  }
};

/**
 * Hàm xuất file Excel cho hàng hóa (chỉ tải về máy, không upload)
 */
const exportToExcel = () => {
  if (excelData.length === 0) {
    alert("Chưa có dữ liệu hàng hóa!");
    return;
  }

  // Tạo workbook và worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Thêm sheet vào workbook
  XLSX.utils.book_append_sheet(wb, ws, "HangHoa");

  // Xuất file Excel (tải về máy)
  XLSX.writeFile(wb, "DanhSachHangHoa.xlsx");
};

/**
 * Set taxCode để dùng cho auto-upload
 * @param {string} taxCode - Mã số thuế
 */
const setUploadConfig = (taxCode) => {
  currentTaxCode = taxCode;
};

export { mapProductDataAsync, exportToExcel, uploadExcelToServer, setUploadConfig };

