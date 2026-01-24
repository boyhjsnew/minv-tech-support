import axios from "axios";

async function inserCKSnewAPP(cksArray, taxCode) {
  const baseUrl = `https://${taxCode}.minvoice.net`;
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
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "sec-ch-ua":
              '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
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
      
      // Safely extract error message
      let errorMessage = "Lỗi không xác định";
      if (error.response?.data) {
        const data = error.response.data;
        if (data.Message && typeof data.Message === "string") {
          errorMessage = data.Message;
        } else if (data.message && typeof data.message === "string") {
          errorMessage = data.message;
        } else if (typeof data === "string") {
          errorMessage = data;
        } else {
          try {
            errorMessage = JSON.stringify(data);
          } catch {
            errorMessage = "Lỗi không xác định";
          }
        }
      } else if (error.message && typeof error.message === "string") {
        errorMessage = error.message;
      }
      
      results.push({
        success: false,
        serialNumber: cks.serialNumber,
        error: errorMessage,
      });
    }
  }

  return results;
}

export default inserCKSnewAPP;
