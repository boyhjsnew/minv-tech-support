import * as XLSX from "xlsx";

let excelData = []; // Biến lưu trữ dữ liệu đã mapping

const mapCustomerDataAsync = async (customerArray) => {
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

  return excelData; // Trả về dữ liệu đã mapping
};

// Hàm xuất file khi người dùng click
const exportToExcel = () => {
  if (excelData.length === 0) {
    alert("Chưa có dữ liệu kìa !");
    return;
  }

  // Tạo workbook và worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Thêm sheet vào workbook
  XLSX.utils.book_append_sheet(wb, ws, "KhachHang");

  // Xuất file Excel
  XLSX.writeFile(wb, "DanhSachKhachHang.xlsx");
};

export { mapCustomerDataAsync, exportToExcel };
