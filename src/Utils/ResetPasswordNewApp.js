import axios from "axios";
import React from "react";

async function ResetPasswordNewApp(taxCode, tokenCrm) {
  const url = "https://admin.minvoice.com.vn/api/Dmkh/ResetPasswordNewApp";
  const body = {
    taxCode,
    customerType: 2,
    account: "support",
    email: "",
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bear ${tokenCrm};VP`,
      },
    });

    console.log(response.data);
    return { token: response.data };
  } catch (error) {
    console.error("Error:", error);
    return { token: null };
  }
}

export default ResetPasswordNewApp;
