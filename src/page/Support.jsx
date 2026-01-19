import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import axios from "axios";
import GetInvoiceFiles from "./GetInvoiceFiles";
import { useSearchParams } from "react-router-dom";

const Support = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("create-serial");
  const [khhdonList, setKhhdonList] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  
  // States for "Cập nhật HĐ lỗi" tab
  const [taxCode, setTaxCode] = useState("");
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [tuSo, setTuSo] = useState("");
  const [denSo, setDenSo] = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [token, setToken] = useState("");
  const [showTokenTooltip, setShowTokenTooltip] = useState(false);

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
    document.title = "Cập nhật DB 2.0";
    // Đọc query parameter từ URL
    const tab = searchParams.get("tab");
    if (tab === "get-files") {
      setActiveTab("get-files");
    } else if (tab === "update-error") {
      setActiveTab("update-error");
    } else if (tab === "fill-gap") {
      setActiveTab("fill-gap");
    }
  }, [searchParams]);

  // Tự động gọi API khi nhập mã số thuế (với debounce)
  useEffect(() => {
    // Chỉ gọi khi đang ở tab "update-error" và có mã số thuế hợp lệ
    if (activeTab !== "update-error") return;
    
    const trimmedTaxCode = taxCode.trim();
    
    // Chỉ gọi khi mã số thuế có ít nhất 5 ký tự
    if (trimmedTaxCode.length < 5) {
      setSeriesList([]);
      setSelectedSeries("");
      return;
    }

    // Debounce: đợi 800ms sau khi người dùng ngừng gõ
    const timeoutId = setTimeout(() => {
      // Gọi API tự động (không hiển thị toast error nếu rỗng)
      handleGetSeries(true);
    }, 800);

    // Cleanup timeout nếu taxCode thay đổi trước khi timeout
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxCode, activeTab]);

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

  // Helper function để retry API call (đặt ngoài để tránh linter warning)
  // Hàm lấy danh sách ký hiệu từ API
  const handleGetSeries = async (isAutoCall = false) => {
    if (!taxCode.trim()) {
      if (!isAutoCall) {
        toast.error(
          <ToastNotify status={1} message="Vui lòng nhập mã số thuế" />,
          { style: styleError }
        );
      }
      return;
    }

    setLoadingSeries(true);
    setSeriesList([]);
    setSelectedSeries("");

    // Kiểm tra nếu mã số thuế kết thúc bằng -998 thì dùng .site, ngược lại dùng .app
    const domain = taxCode.endsWith("-998") ? ".minvoice.site" : ".minvoice.app";
    const url = `https://${taxCode}${domain}/api/InvoiceApi78/GetTypeInvoiceSeries`;

    const headers = {
      Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.get(url, { headers });

      if (response?.data && response.data.code === "00" && response.data.data) {
        setSeriesList(response.data.data);
        if (response.data.data.length > 0) {
          toast.success(
            <ToastNotify
              status={0}
              message={`Tìm thấy ${response.data.data.length} ký hiệu`}
            />,
            { style: styleSuccess }
          );
        } else {
          toast.warning(
            <ToastNotify status={1} message="Không tìm thấy ký hiệu nào" />,
            { style: styleError }
          );
        }
      } else {
        throw new Error(
          response?.data?.message || "Không thể lấy danh sách ký hiệu"
        );
      }
    } catch (error) {
      console.error("Error fetching series:", error.message);
      if (error.response) {
        console.error("Response error:", error.response.data);
      }
      toast.error(
        <ToastNotify
          status={1}
          message={
            error.response?.data?.message ||
            error.message ||
            "Lỗi khi lấy danh sách ký hiệu"
          }
        />,
        { style: styleError }
      );
      setSeriesList([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  // Hàm cập nhật hóa đơn lỗi - lấy ID và cập nhật ngay
  const handleUpdateErrorInvoices = async () => {
    if (!taxCode.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập mã số thuế" />,
        { style: styleError }
      );
      return;
    }

    if (!selectedSeries) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng chọn ký hiệu" />,
        { style: styleError }
      );
      return;
    }

    if (!tuSo.trim() || !denSo.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập từ số và đến số" />,
        { style: styleError }
      );
      return;
    }

    if (!token.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập token" />,
        { style: styleError }
      );
      return;
    }

    const tuSoNum = parseInt(tuSo);
    const denSoNum = parseInt(denSo);

    if (isNaN(tuSoNum) || isNaN(denSoNum) || tuSoNum > denSoNum) {
      toast.error(
        <ToastNotify status={1} message="Số hóa đơn không hợp lệ. Từ số phải nhỏ hơn hoặc bằng đến số" />,
        { style: styleError }
      );
      return;
    }

    setLoadingInvoices(true);
    setInvoiceList([]);

    // Kiểm tra nếu mã số thuế kết thúc bằng -998 thì dùng .site, ngược lại dùng .app
    const domain = taxCode.endsWith("-998") ? ".minvoice.site" : ".minvoice.app";
    const baseUrl = `https://${taxCode}${domain}/api/InvoiceApi78/GetInfoInvoice`;

    const getInvoiceHeaders = {
      Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
      "Content-Type": "application/json",
    };

    const updateUrl = "https://n8n.minvoice.com.vn/webhook/login";
    const updateHeaders = {
      "Content-Type": "application/json",
      Accept: "*/*",
    };

    const results = [];
    const total = denSoNum - tuSoNum + 1;
    let successCount = 0;
    let updateSuccessCount = 0;
    let updateErrorCount = 0;

    try {
      // Lặp qua từng số hóa đơn từ tuSo đến denSo
      for (let number = tuSoNum; number <= denSoNum; number++) {
        const url = `${baseUrl}?number=${number}&seri=${selectedSeries}`;
        
        try {
          // Bước 1: Lấy thông tin hóa đơn
          const response = await axios.get(url, { headers: getInvoiceHeaders });
          
          if (response?.data && response.data.code === "00" && response.data.data) {
            const invoice = response.data.data;
            const tthai = invoice.tthai || "";
            
            // Chỉ xử lý hóa đơn có trạng thái "Chờ ký"
            if (tthai === "Chờ ký") {
              const invoiceId = invoice.inv_invoiceAuth_id || invoice.hoadon68_id;
              
              if (invoiceId) {
                // Bước 2: Cập nhật hóa đơn qua API n8n
                try {
                  const updateBody = {
                    token: token.trim(),
                    caseType: "UD04",
                    TaxCode: taxCode.trim(),
                    Id: invoiceId,
                  };

                  const updateResponse = await axios.post(updateUrl, updateBody, { headers: updateHeaders });

                  if (updateResponse?.data) {
                    results.push({
                      number: number,
                      seri: selectedSeries,
                      hoadon68_id: invoice.hoadon68_id,
                      inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
                      khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
                      shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
                      tthai: tthai,
                      status: "success",
                      updateStatus: "success",
                    });
                    updateSuccessCount++;
                  } else {
                    throw new Error("Không nhận được phản hồi từ server");
                  }
                } catch (updateError) {
                  results.push({
                    number: number,
                    seri: selectedSeries,
                    hoadon68_id: invoice.hoadon68_id,
                    inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
                    khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
                    shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
                    tthai: tthai,
                    status: "success",
                    updateStatus: "error",
                    updateError: updateError.response?.data?.message || updateError.message || "Lỗi khi cập nhật",
                  });
                  updateErrorCount++;
                }
              } else {
                results.push({
                  number: number,
                  seri: selectedSeries,
                  hoadon68_id: invoice.hoadon68_id,
                  inv_invoiceAuth_id: null,
                  khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
                  shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
                  tthai: tthai,
                  status: "success",
                  updateStatus: "error",
                  updateError: "Không tìm thấy ID hóa đơn",
                });
                updateErrorCount++;
              }
              successCount++;
            }
          }
        } catch (error) {
          // Lỗi khi lấy thông tin hóa đơn
          results.push({
            number: number,
            seri: selectedSeries,
            hoadon68_id: null,
            inv_invoiceAuth_id: null,
            khieu: selectedSeries,
            shdon: number,
            tthai: "Lỗi",
            status: "error",
            updateStatus: "error",
            updateError: error.response?.data?.message || error.message || "Lỗi khi lấy thông tin",
          });
        }

        // Thêm delay nhỏ giữa các request để tránh quá tải
        if (number < denSoNum) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      setInvoiceList(results);

      // Hiển thị thông báo kết quả
      if (successCount > 0) {
        if (updateSuccessCount > 0) {
          toast.success(
            <ToastNotify
              status={0}
              message={`Đã cập nhật thành công ${updateSuccessCount}/${total} hóa đơn trong khoảng ${tuSo} - ${denSo}`}
            />,
            { style: styleSuccess }
          );
        }
        if (updateErrorCount > 0) {
          toast.warning(
            <ToastNotify
              status={1}
              message={`Có ${updateErrorCount}/${total} hóa đơn cập nhật thất bại trong khoảng ${tuSo} - ${denSo}`}
            />,
            { style: styleError }
          );
        }
      } else {
        toast.warning(
          <ToastNotify status={1} message={`Không tìm thấy hóa đơn "Chờ ký" nào trong khoảng ${tuSo} - ${denSo} (${total} hóa đơn đã kiểm tra)`} />,
          { style: styleError }
        );
      }
    } catch (error) {
      console.error("Error updating invoices:", error);
      toast.error(
        <ToastNotify
          status={1}
          message={
            error.response?.data?.message ||
            error.message ||
            "Lỗi khi cập nhật hóa đơn"
          }
        />,
        { style: styleError }
      );
    } finally {
      setLoadingInvoices(false);
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

      {/* Tab Navigation */}
      <div style={{ marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <button
          onClick={() => setActiveTab("create-serial")}
          style={{
            display: "none", // Ẩn tab "Tạo hàng loạt ký hiệu"
            padding: "10px 20px",
            backgroundColor:
              activeTab === "create-serial" ? "#007bff" : "transparent",
            color: activeTab === "create-serial" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "create-serial" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "create-serial" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Tạo hàng loạt ký hiệu
        </button>
        <button
          onClick={() => setActiveTab("get-files")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "get-files" ? "#007bff" : "transparent",
            color: activeTab === "get-files" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "get-files" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "get-files" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Lấy PDF và XML
        </button>
        <button
          onClick={() => setActiveTab("update-error")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "update-error" ? "#007bff" : "transparent",
            color: activeTab === "update-error" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "update-error" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "update-error" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Cập nhật HĐ lỗi
        </button>
        <button
          onClick={() => setActiveTab("fill-gap")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "fill-gap" ? "#007bff" : "transparent",
            color: activeTab === "fill-gap" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "fill-gap" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "fill-gap" ? "bold" : "normal",
          }}
        >
          Lấp lủng HĐ
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "create-serial" && (
        <>
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
              <div
                style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}
              >
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
                          backgroundColor: result.success
                            ? "#d4edda"
                            : "#f8d7da",
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
        </>
      )}

      {activeTab === "get-files" && <GetInvoiceFiles />}

      {activeTab === "update-error" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>Cập nhật HĐ lỗi</h1>
          
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              maxWidth: "600px",
            }}
          >
            {/* Input mã số thuế */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                Mã số thuế
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  placeholder="Nhập mã số thuế (ví dụ: 3500578186)"
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleGetSeries();
                    }
                  }}
                />
                <button
                  onClick={handleGetSeries}
                  disabled={!taxCode.trim() || loadingSeries}
                  style={{
                    padding: "10px 20px",
                    backgroundColor:
                      !taxCode.trim() || loadingSeries ? "#ccc" : "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor:
                      !taxCode.trim() || loadingSeries
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loadingSeries ? "Đang tải..." : "Lấy ký hiệu"}
                </button>
              </div>
            </div>

            {/* Dropdown chọn ký hiệu */}
            {seriesList.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Chọn ký hiệu
                </label>
                <select
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  <option value="">-- Chọn ký hiệu --</option>
                  {seriesList.map((series) => (
                    <option key={series.id} value={series.khhdon}>
                      {series.khhdon} - {series.invoiceTypeName}
                    </option>
                  ))}
                </select>
                {selectedSeries && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#e7f3ff",
                      borderRadius: "4px",
                      fontSize: "13px",
                      color: "#0066cc",
                    }}
                  >
                    Đã chọn: <strong>{selectedSeries}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Input token */}
            {selectedSeries && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <label
                    style={{
                      fontWeight: "bold",
                      fontSize: "14px",
                      margin: 0,
                    }}
                  >
                    Token
                  </label>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                    onMouseEnter={() => setShowTokenTooltip(true)}
                    onMouseLeave={() => setShowTokenTooltip(false)}
                  >
                    <i
                      className="fa-solid fa-circle-info"
                      style={{
                        color: "#007bff",
                        cursor: "pointer",
                        fontSize: "16px",
                      }}
                    ></i>
                    {showTokenTooltip && (
                      <div
                        style={{
                          position: "absolute",
                          left: "20px",
                          top: "0",
                          backgroundColor: "#333",
                          color: "#fff",
                          padding: "12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          width: "320px",
                          zIndex: 1000,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          lineHeight: "1.6",
                        }}
                      >
                        <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
                          Hướng dẫn lấy token:
                        </div>
                        <ol style={{ margin: 0, paddingLeft: "20px" }}>
                          <li>Truy cập: <a href="https://msupport.minvoice.com.vn/Update" target="_blank" rel="noopener noreferrer" style={{ color: "#4da6ff" }}>https://msupport.minvoice.com.vn/Update</a></li>
                          <li>Nhấn <strong>F12</strong> để mở Developer Tools</li>
                          <li>Chọn tab <strong>Application</strong></li>
                          <li>Mở <strong>Storage</strong> → <strong>Local storage</strong></li>
                          <li>Tìm key <strong>"token"</strong> và copy giá trị</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Nhập token để cập nhật hóa đơn"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>
            )}

            {/* Input từ số - đến số */}
            {selectedSeries && (
              <>
                <div style={{ marginTop: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    Số hóa đơn
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="number"
                      value={tuSo}
                      onChange={(e) => setTuSo(e.target.value)}
                      placeholder="Từ số"
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "14px",
                      }}
                    />
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>-</span>
                    <input
                      type="number"
                      value={denSo}
                      onChange={(e) => setDenSo(e.target.value)}
                      placeholder="Đến số"
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <button
                    onClick={handleUpdateErrorInvoices}
                    disabled={!tuSo.trim() || !denSo.trim() || !token.trim() || loadingInvoices}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor:
                        !tuSo.trim() || !denSo.trim() || !token.trim() || loadingInvoices
                          ? "#ccc"
                          : "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "14px",
                      cursor:
                        !tuSo.trim() || !denSo.trim() || !token.trim() || loadingInvoices
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {loadingInvoices ? "Đang cập nhật..." : "Cập nhật lỗi"}
                  </button>
                </div>
              </>
            )}

            {/* Hiển thị kết quả danh sách hóa đơn */}
            {invoiceList.length > 0 && (
              <div style={{ marginTop: "30px" }}>
                <h3 style={{ marginBottom: "15px", fontSize: "16px", fontWeight: "bold" }}>
                  Kết quả cập nhật hóa đơn ({invoiceList.length})
                </h3>
                <div
                  style={{
                    maxHeight: "400px",
                    overflowY: "auto",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: "white",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f8f9fa",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          STT
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Ký hiệu
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Số HĐ
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          ID Hóa đơn
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Trạng thái
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Kết quả cập nhật
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceList.map((invoice, index) => (
                        <tr
                          key={`${invoice.seri}-${invoice.number}-${index}`}
                          style={{
                            borderBottom: "1px solid #dee2e6",
                            backgroundColor: 
                              invoice.status === "success"
                                ? index % 2 === 0 ? "#f0fdf4" : "#dcfce7"
                                : index % 2 === 0 ? "#fff" : "#f8f9fa",
                          }}
                        >
                          <td style={{ padding: "10px" }}>{index + 1}</td>
                          <td style={{ padding: "10px" }}>
                            {invoice.khieu || invoice.seri || "-"}
                          </td>
                          <td style={{ padding: "10px" }}>
                            {invoice.shdon || invoice.number || "-"}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              fontFamily: "monospace",
                              fontSize: "11px",
                              wordBreak: "break-all",
                            }}
                          >
                            {invoice.hoadon68_id || (
                              <span style={{ color: "#dc2626", fontSize: "10px" }}>
                                {invoice.error || "Không tìm thấy"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px" }}>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                backgroundColor:
                                  invoice.status === "success"
                                    ? invoice.tthai === "Đã gửi"
                                      ? "#d4edda"
                                      : invoice.tthai === "Chưa gửi"
                                      ? "#fff3cd"
                                      : "#e7f3ff"
                                    : "#f8d7da",
                                color:
                                  invoice.status === "success"
                                    ? invoice.tthai === "Đã gửi"
                                      ? "#155724"
                                      : invoice.tthai === "Chưa gửi"
                                      ? "#856404"
                                      : "#0066cc"
                                    : "#721c24",
                              }}
                            >
                              {invoice.tthai || "N/A"}
                            </span>
                            {invoice.updateStatus === "success" && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  backgroundColor: "#d4edda",
                                  color: "#155724",
                                }}
                              >
                                ✓ Đã cập nhật
                              </span>
                            )}
                            {invoice.updateStatus === "error" && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  backgroundColor: "#f8d7da",
                                  color: "#721c24",
                                }}
                              >
                                ✗ Lỗi
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px" }}>
                            {invoice.updateStatus === "success" && (
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: "#d4edda",
                                  color: "#155724",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓ Thành công
                              </span>
                            )}
                            {invoice.updateStatus === "error" && (
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: "#f8d7da",
                                  color: "#721c24",
                                  fontWeight: "bold",
                                }}
                                title={invoice.updateError || "Lỗi"}
                              >
                                ✗ Thất bại
                              </span>
                            )}
                            {!invoice.updateStatus && invoice.status === "error" && (
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: "#f8d7da",
                                  color: "#721c24",
                                  fontWeight: "bold",
                                }}
                              >
                                ✗ Lỗi lấy thông tin
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hiển thị lỗi nếu có */}
            {loadingSeries === false && seriesList.length === 0 && taxCode && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px",
                  backgroundColor: "#fff3cd",
                  borderRadius: "4px",
                  fontSize: "13px",
                  color: "#856404",
                }}
              >
                Không tìm thấy ký hiệu nào. Vui lòng kiểm tra lại mã số thuế.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "fill-gap" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>Lấp lủng HĐ</h1>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
            <p style={{ color: "#666", fontSize: "14px" }}>
              Tính năng đang được phát triển...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
