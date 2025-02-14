import axios from "axios";

async function inserDMKH(dmkhArray, taxCode, cookies) {
  let successCount = 0;
  let errorCount = 0;
  let errorDetails = []; // Lưu thông tin lỗi

  for (const dmkhData of dmkhArray) {
    const cksData = {
      code: dmkhData.code,
      taxCode: dmkhData.taxCode || "",
      name: dmkhData.name,
      personContact: dmkhData.personContact || "",
      address: dmkhData.address || ".",
      email: dmkhData.email,
      mobile: dmkhData.mobile || null,
      bankAccount: null,
      bankName: null,
      inputChange: null,
    };

    try {
      console.log(`Đang gửi dữ liệu cho khách hàng: ${dmkhData.code}`);

      const response = await axios.post(
        `https://${taxCode}.minvoice.net/api/api/app/tenant-client`,
        cksData,
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            credentials: "include",
            Cookie: cookies,
          },
          withCredentials: true,
        }
      );

      if (response.status === 200 || response.status === 201) {
        successCount++;
      } else {
        errorCount++;
        errorDetails.push({
          code: dmkhData.code,
          errorCode: response.data?.error?.code || "Unknown",
          message: response.data?.error?.message || "Không có thông báo lỗi",
        });
      }
    } catch (error) {
      errorCount++;
      const errorResponse = error.response?.data?.error || {};
      errorDetails.push({
        code: dmkhData.code,
        errorCode: errorResponse.code || "Unknown",
        message: errorResponse.message || error.message,
      });
    }
  }

  console.log(`✅ Tổng số dòng thành công: ${successCount}`);
  console.log(`❌ Tổng số dòng lỗi: ${errorCount}`);

  if (errorDetails.length > 0) {
    console.log("Chi tiết lỗi:");
    errorDetails.forEach((err, index) => {
      console.log(
        `${index + 1}. Mã KH: ${err.code} | Mã lỗi: ${
          err.errorCode
        } | Nội dung: ${err.message}`
      );
    });
  }

  // Quan trọng: Trả về kết quả để fetchDataDMKH có thể sử dụng
  return { successCount, errorCount, errorDetails };
}

export default inserDMKH;
