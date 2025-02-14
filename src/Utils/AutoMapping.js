import * as XLSX from "xlsx";

let excelData = []; // Lưu dữ liệu đã mapping

const mapCustomerData = async (customerArray) => {
  excelData = customerArray.map((data) => ({
    "Mã khách hàng *": data.ma_dt,
    "Tên đơn vị": data.ten_dt,
    "Mã số thuế": data.ms_thue || "",
    "Người mua hàng": data.dai_dien || "",
    "Địa chỉ *": data.dia_chi || ".",
    "Điện thoại": data.dien_thoai || null,
    Email: data.email,
    "Số tài khoản": null,
    "Tên ngân hàng": null,
  }));

  return excelData;
};

// 🆕 Xuất file nhưng không tải xuống, mà trả về Blob
const exportToExcelAuto = () => {
  alert(excelData);
  if (excelData.length === 0) {
    throw new Error("Không có dữ liệu để xuất file!");
  }

  // Tạo workbook và worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);
  XLSX.utils.book_append_sheet(wb, ws, "KhachHang");

  // Xuất file Excel thành Blob
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return blob; // Trả về file Blob để upload ngay lập tức
};

export { mapCustomerData, exportToExcelAuto };
