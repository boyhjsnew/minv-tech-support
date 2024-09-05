import axios from "axios";
import React from "react";

async function ResetPassword(taxCode, tokenCrm) {
  const url = "https://admin.minvoice.com.vn/api/Dmkh/ResetPassword";
  const body = {
    taxCode,
    customerType: 1,
    account: "ADMINISTRATOR",
    email: "",
    windowno: "WIN00101",
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",

        Authorization: `Bear ${tokenCrm};VP`,
      },
    });

    console.log(response.data);
    return { token: response.data.data };
  } catch (error) {
    console.error("Error:", error);
    return { token: null };
  }
}

export default ResetPassword;
