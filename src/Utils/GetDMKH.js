import axios from "axios";

const getDMKH = async (taxCode) => {
  let sanitizedTaxCode = taxCode.replace(/-/g, "");
  const url = `https://${sanitizedTaxCode}.minvoice.com.vn/api/System/GetDataByWindowNo1`;

  const headers = {
    Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
    "Content-Type": "application/json",
  };

  let allData = [];
  let start = 0;
  const limit = 1000;

  try {
    while (true) {
      const body = {
        window_id: "WIN00009",
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
  }
};

export default getDMKH;
