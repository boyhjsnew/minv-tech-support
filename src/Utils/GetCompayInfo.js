// src/Utils/GetCompanyInfo.js

const GetCompanyInfo = async (taxCode) => {
  try {
    // Kiểm tra taxCode có tồn tại không
    if (!taxCode) {
      throw new Error("Mã số thuế không được để trống");
    }

    // Chuẩn bị URL với taxCode
    const url = `https://${taxCode}.minvoice.com.vn/api/System/GetInfoCompany`;

    // Gọi API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",

        // Thêm các header khác nếu cần
      },
    });

    // Kiểm tra response
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse JSON response
    const data = await response.json();

    // Kiểm tra response data
    if (!data) {
      throw new Error("Không nhận được dữ liệu từ server");
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin doanh nghiệp:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default GetCompanyInfo;
