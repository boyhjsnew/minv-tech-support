import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import axios from "axios";

const Support = () => {
  const [khhdonList, setKhhdonList] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const domain = "http://bienlai70.vpdkddtphcm.com.vn";

  // Các trường cố định
  const fixedData = {
    lhdon: "1",
    hthuc: "C",
    khdon: "T",
    mau_so: "CTT56",
    sdmau: 8,
    quanlymau68_id: "aae35b0a-714c-4660-bdff-76060801d38d",
    loai_doanh_nghiep: "",
  };

  useEffect(() => {
    document.title = "Hỗ trợ kỹ thuật";
  }, []);

  const createSerial = async (khhdon) => {
    const url = `${domain}/api/Serial/SerialSaveChange`;

    const requestData = {
      ...fixedData,
      khhdon: khhdon.trim(),
    };

    try {
      const response = await axios.post(url, requestData, {
        headers: {
          Accept: "*/*",
          "Accept-Language":
            "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
          Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-type": "application/json",
          Origin: domain,
          Pragma: "no-cache",
          Referer: `${domain}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        },
        withCredentials: true,
      });

      return {
        success: true,
        khhdon,
        data: response.data,
        message: `Tạo thành công cho ${khhdon}`,
      };
    } catch (error) {
      return {
        success: false,
        khhdon,
        error: error.response?.data || error.message,
        message: `Lỗi khi tạo ${khhdon}: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!khhdonList.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập danh sách ký hiệu" />,
        { style: styleError }
      );
      return;
    }

    // Parse danh sách ký hiệu (mỗi dòng một ký hiệu)
    const khhdonArray = khhdonList
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (khhdonArray.length === 0) {
      toast.error(
        <ToastNotify status={1} message="Danh sách ký hiệu không hợp lệ" />,
        { style: styleError }
      );
      return;
    }

    setProcessing(true);
    setResults([]);

    const newResults = [];
    let successCount = 0;
    let failCount = 0;

    // Lặp qua từng ký hiệu và gọi API
    for (let i = 0; i < khhdonArray.length; i++) {
      const khhdon = khhdonArray[i];
      const result = await createSerial(khhdon);
      newResults.push(result);

      if (result.success) {
        successCount++;
        toast.success(<ToastNotify status={0} message={result.message} />, {
          style: styleSuccess,
        });
      } else {
        failCount++;
        toast.error(<ToastNotify status={1} message={result.message} />, {
          style: styleError,
        });
      }

      // Cập nhật kết quả sau mỗi request
      setResults([...newResults]);
    }

    setProcessing(false);

    // Thông báo tổng kết
    toast.info(
      <ToastNotify
        status={0}
        message={`Hoàn thành: ${successCount} thành công, ${failCount} thất bại`}
      />,
      { style: styleSuccess }
    );
  };

  return (
    <div
      className="support-container"
      style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}
    >
      <ToastContainer />
      <h1 style={{ marginBottom: "20px" }}>Tạo hàng loạt ký hiệu</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            Danh sách ký hiệu (mỗi dòng một ký hiệu)
          </label>
          <textarea
            value={khhdonList}
            onChange={(e) => setKhhdonList(e.target.value)}
            placeholder="1C26TES&#10;1C27TES&#10;1C28TES"
            rows={15}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              fontFamily: "monospace",
            }}
          />
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
            Nhập mỗi ký hiệu trên một dòng. Ví dụ: 1C26TES, 1C27TES, 1C28TES
          </div>
        </div>

        <button
          type="submit"
          disabled={processing}
          style={{
            padding: "12px 24px",
            backgroundColor: processing ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            cursor: processing ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {processing ? "Đang xử lý..." : "Tạo hàng loạt"}
        </button>
      </form>

      {results.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h2 style={{ marginBottom: "15px" }}>Kết quả</h2>
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    STT
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Ký hiệu
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Trạng thái
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    Thông báo
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr
                    key={index}
                    style={{
                      backgroundColor: result.success ? "#d4edda" : "#f8d7da",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    <td style={{ padding: "10px" }}>{index + 1}</td>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>
                      {result.khhdon}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          backgroundColor: result.success
                            ? "#28a745"
                            : "#dc3545",
                          color: "white",
                          fontSize: "12px",
                        }}
                      >
                        {result.success ? "Thành công" : "Thất bại"}
                      </span>
                    </td>
                    <td style={{ padding: "10px", fontSize: "12px" }}>
                      {result.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
