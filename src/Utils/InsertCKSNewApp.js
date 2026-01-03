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
  const requestVerificationToken = getRequestVerificationToken(cookies);
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

      const response = await axios.post(
        `${baseUrl}/api/api/app/token`,
        cksData,
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/json",
            Origin: baseUrl,
            Referer: `${baseUrl}/`,
            RequestVerificationToken: requestVerificationToken,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "sec-ch-ua":
              '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            Cookie: cookies,
          },
          withCredentials: true,
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
