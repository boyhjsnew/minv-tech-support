import React from "react";

async function GetTokenCRM(username, password, ma_dvcs) {
  const url = "https://admin.minvoice.com.vn/api/Account/Login";
  const body = {
    username: username,
    password: password,
    ma_dvcs: ma_dvcs,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { token: data.token };
  } catch (error) {
    console.error("Error:", error);
    return { token: null };
  }
}

export default GetTokenCRM;
