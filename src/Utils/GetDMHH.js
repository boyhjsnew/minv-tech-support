import axios from "axios";
import Login from "./Login.js";
import GetTokenCRM from "./GetTokenCRM.js";
import ResetPassword from "./ResetPassword.js";

const getDMHH = async (taxCode) => {
  let sanitizedTaxCode = taxCode.replace(/-/g, "");
  const url = `https://${sanitizedTaxCode}.minvoice.com.vn/api/System/GetDataByWindowNo1`;

  // Lấy token từ localStorage hoặc login
  let token = null;
  try {
    // Thử lấy token từ localStorage (nếu đã login trước đó)
    const storedAccount = localStorage.getItem("account");
    if (storedAccount) {
      const account = JSON.parse(storedAccount);
      // Lấy token CRM
      const tokenCrmResponse = await GetTokenCRM(
        account.username,
        account.password,
        account.madvcs || "VP"
      );
      if (tokenCrmResponse.token) {
        // Reset password để lấy token đăng nhập 1.0
        const resetPasswordResponse = await ResetPassword(
          taxCode,
          tokenCrmResponse.token
        );
        if (resetPasswordResponse.token) {
          // Login để lấy token
          const loginResponse = await Login(taxCode, resetPasswordResponse.token);
          token = loginResponse.token;
        }
      }
    }
  } catch (error) {
    console.error("Error getting token:", error);
  }

  if (!token) {
    throw new Error("Không thể lấy được token. Vui lòng đăng nhập lại.");
  }

  const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Authorization: `Bear ${token}`,
    Connection: "keep-alive",
    "Content-type": "application/json",
    Referer: `https://${sanitizedTaxCode}.minvoice.com.vn/`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };

  let allData = [];
  let start = 0;
  const limit = 50; // Theo curl mẫu

  try {
    while (true) {
      const body = {
        window_id: "WIN00015",
        start: start,
        count: limit,
        filter: [],
        infoparam: null,
        tlbparam: [],
      };

      // Gọi API
      const response = await axios.post(url, body, { headers });
      console.log("Response data:", response.data);

      if (
        !response.data ||
        !response.data.data ||
        response.data.data.length === 0
      ) {
        break;
      }

      // Thêm dữ liệu vào mảng allData
      allData = [...allData, ...response.data.data];

      // Nếu số lượng bản ghi trả về nhỏ hơn giới hạn, coi như đã lấy đủ dữ liệu
      if (response.data.data.length < limit) {
        break;
      }

      start += limit;
    }

    return allData; // Trả về toàn bộ dữ liệu sau khi gọi API đủ số lần
  } catch (error) {
    console.error("Error calling API:", error.message);
    if (error.response) {
      console.error("Response error:", error.response.data);
    }
    throw error;
  }
};

export default getDMHH;
