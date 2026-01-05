import axios from "axios";

// Hàm helper để lấy RequestVerificationToken từ cookies
function getRequestVerificationToken(cookies) {
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

async function inserCKSnewAPP(cksArray, taxCode, cookies) {
  const baseUrl = `https://${taxCode}.minvoice.net`;
  
  // Lấy RequestVerificationToken từ cookies (nếu có)
  // Nếu không có cookies trong localStorage, thử lấy từ document.cookie (nếu cùng domain)
  let requestVerificationToken = "";
  if (cookies) {
    requestVerificationToken = getRequestVerificationToken(cookies);
  } else {
    // Thử lấy từ document.cookie nếu đang ở cùng domain
    try {
      const docCookies = document.cookie;
      if (docCookies) {
        requestVerificationToken = getRequestVerificationToken(docCookies);
      }
    } catch (e) {
      // Cross-origin, không thể lấy document.cookie
      console.log("Cannot access document.cookie due to cross-origin");
    }
  }
  
  const results = [];

  for (const cks of cksArray) {
    const cksData = {
      vender: cks.vender,
      subjectName: cks.subjectName,
      serialNumber: cks.serialNumber,
      dateFrom: cks.dateFrom,
      expireDate: cks.expireDate,
      form: cks.form,
      tokenType: cks.tokenType,
      used: true,
    };

    try {
      console.log("Before axios request for CKS:", cks.serialNumber);

      // Tạo headers object
      const headers = {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        "Content-Type": "application/json",
        Origin: baseUrl,
        Referer: `${baseUrl}/`,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      };

      // Chỉ thêm RequestVerificationToken nếu có
      if (requestVerificationToken) {
        headers.RequestVerificationToken = requestVerificationToken;
      }

      // Nếu có cookies từ localStorage và không thể dùng withCredentials (cross-origin),
      // thì gửi cookies trong header (chỉ khi thực sự cần thiết)
      // Nhưng ưu tiên dùng withCredentials: true để browser tự động gửi cookies
      // Chỉ thêm header Cookie nếu cookies được cung cấp và withCredentials không hoạt động
      // Tuy nhiên, tốt nhất là để browser tự động gửi cookies với withCredentials: true

      const response = await axios.post(
        `${baseUrl}/api/api/app/token`,
        cksData,
        {
          headers,
          withCredentials: true, // Browser sẽ tự động gửi cookies của domain .net
        }
      );

      console.log(
        "After axios request - Success for CKS:",
        cks.serialNumber,
        response.data
      );
      results.push({
        success: true,
        serialNumber: cks.serialNumber,
        data: response.data,
      });
    } catch (error) {
      console.error(
        "Error posting CKS:",
        cks.serialNumber,
        error.response?.data || error.message
      );
      results.push({
        success: false,
        serialNumber: cks.serialNumber,
        error: error.response?.data || error.message,
      });
    }
  }

  return results;
}

export default inserCKSnewAPP;
