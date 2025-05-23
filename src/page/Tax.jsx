import React, { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx"; // Import thư viện xlsx

const TaxCodeFetcher = () => {
  const [taxCodes, setTaxCodes] = useState([]);
  const [result, setResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Hàm gọi API để lấy thông tin từ mã số thuế
  const fetchTaxInfo = async (taxCode) => {
    try {
      const response = await axios.get(
        `https://qlhd.minvoice.com.vn/api/org-by-tax-code/${taxCode}`,
        {
          headers: {
            apiToken:
              "67c168655779ba53130dbb0d.1d9b275bb6ec8e940268312c1f325b08a2a58dcdb798115dd75e400c4b1d63b8.d703f516f0e37d855906282038ef94a78b3654db0188866170336b6154f66a7b",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching data for tax code:", taxCode, error);
      throw error;
    }
  };

  // Hàm xử lý gọi API cho tất cả các MST trong danh sách
  const fetchTaxInfoForAllCodes = async () => {
    setLoading(true);
    setError(null);
    const fetchedResults = [];

    try {
      for (const taxCode of taxCodes) {
        const result = await fetchTaxInfo(taxCode);
        fetchedResults.push(result);
      }
      setResult(fetchedResults);
    } catch (err) {
      setError("Error fetching tax code data");
    } finally {
      setLoading(false);
    }
  };

  // Hàm tải lên file Excel và trích xuất danh sách MST
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Đọc file Excel và trích xuất dữ liệu (giả sử các MST nằm trong cột đầu tiên)
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: "binary" }); // Sử dụng XLSX đã import
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const mstList = XLSX.utils
        .sheet_to_json(sheet, { header: 1 })
        .map((row) => row[0]); // Lấy cột đầu tiên (MST)
      setTaxCodes(mstList);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="">
      <h1>Fetch Information by Tax Code</h1>

      {/* Tải lên file Excel */}
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      {/* Nút gọi API */}
      <button onClick={fetchTaxInfoForAllCodes} disabled={loading}>
        {loading ? "Loading..." : "Fetch Tax Info"}
      </button>

      {/* Hiển thị kết quả */}
      {error && <div style={{ color: "red" }}>{error}</div>}
      <div>
        {result.length > 0 && (
          <ul>
            {result.map((data, index) => (
              <li key={index}>
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TaxCodeFetcher;
