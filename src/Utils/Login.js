import axios from "axios";

import qs from "qs"; // Import qs để chuyển đổi dữ liệu sang dạng x-www-form-urlencoded
import { replace } from "react-router-dom";

async function Login(taxCode, password) {
  let sanitizedTaxCode = taxCode.replace(/-/g, "");
  const url = `https://${sanitizedTaxCode}.minvoice.com.vn/api/Account/Login`; // Thay "yourdomain.com" bằng tên miền của bạn

  const body = qs.stringify({
    username: "ADMINISTRATOR",
    password: password,
    ma_dvcs: "VP",
  });

  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log(response.data);
    return { token: response.data.token };
  } catch (error) {
    console.error("Error:", error);
    return { token: null };
  }
}

export default Login;
