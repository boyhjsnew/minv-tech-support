import axios from "axios";
import React from "react";

async function inserCKSnewAPP(cksArray, taxCode, cookies) {
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
      console.log("Before axios request");
      const response = await axios.post(
        `https://${taxCode}.minvoice.net/api/api/app/token`,
        cksData,
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            credentials: "include",
            Cookie: cookies, // Thêm cookies vào đây
          },
          withCredentials: true,
        }
      );
      console.log("After axios request", response.error);
    } catch (error) {
      console.error("Error posting CKS:", cks.serialNumber, error.error);
    }
  }
}

export default inserCKSnewAPP;
