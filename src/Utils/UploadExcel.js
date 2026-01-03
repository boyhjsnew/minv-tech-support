import axios from "axios";

/**
 * Lấy RequestVerificationToken từ cookies (từ document.cookie)
 * @returns {string} - RequestVerificationToken
 */
function getRequestVerificationToken() {
  // Lấy cookies từ document.cookie (browser tự động có)
  const cookies = document.cookie;
  if (!cookies) return "";

  // Tìm XSRF-TOKEN trong cookies
  const xsrfMatch = cookies.match(/XSRF-TOKEN=([^;]+)/);
  if (xsrfMatch) {
    // Decode URL encoded value
    return decodeURIComponent(xsrfMatch[1]);
  }

  // Nếu không tìm thấy XSRF-TOKEN, thử tìm RequestVerificationToken trực tiếp
  const tokenMatch = cookies.match(/RequestVerificationToken=([^;]+)/);
  if (tokenMatch) {
    return decodeURIComponent(tokenMatch[1]);
  }

  return "";
}

/**
 * Upload file Excel khách hàng lên 2.0
 * Browser sẽ tự động gửi cookies theo domain (vì đã đăng nhập)
 * @param {File} file - File Excel cần upload
 * @param {string} taxCode - Mã số thuế
 * @returns {Promise<Object>} - Kết quả upload
 */
const uploadExcelFile = async (file, taxCode) => {
  if (!file) {
    console.error("❌ Không có file để upload!");
    throw new Error("Vui lòng chọn file trước khi upload.");
  }

  const baseUrl = `https://${taxCode}.minvoice.net`;
  const requestVerificationToken = getRequestVerificationToken();

  const formData = new FormData();
  formData.append("files", file, file.name);

  try {
    const url = `${baseUrl}/api/api/app/tenant-client/upload`;

    const response = await axios.post(url, formData, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        Referer: `${baseUrl}/`,
        RequestVerificationToken: requestVerificationToken,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        // Không set Content-Type để browser tự động set với boundary cho FormData
        // Không set Cookie header - browser sẽ tự động gửi cookies theo domain
      },
      withCredentials: true, // Quan trọng: cho phép gửi cookies tự động
    });

    if (response.status === 200 || response.status === 201) {
      console.log("✅ Upload thành công:", response.data);
      return {
        success: true,
        data: response.data,
        message: "Upload thành công",
      };
    } else {
      throw new Error(`Lỗi server: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Upload thất bại:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
      message: error.response?.data?.message || "Lỗi khi upload file",
    };
  }
};

export default uploadExcelFile;
