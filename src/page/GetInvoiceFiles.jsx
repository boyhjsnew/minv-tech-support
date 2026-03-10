import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import axios from "axios";

const GetInvoiceFiles = () => {
  const [taxCode, setTaxCode] = useState("0313364566");
  const [voucherSymbolId, setVoucherSymbolId] = useState(
    "3a1f9ba8-f2a8-e869-6c6c-18e417e4af8a"
  );
  // Bearer & XSRF mặc định lấy từ curl mẫu (có thể sửa trực tiếp trong code khi cần)
  const DEFAULT_BEARER =
    "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IkRGREQyM0Y5NTM3RTQyQ0FCNUU5NDM1MDEzRTJBMzBFMzRCMjVCNEIiLCJ4NXQiOiIzOTBqLVZOLVFzcTE2VU5RRS1LakRqU3lXMHMiLCJ0eXAiOiJhdCtqd3QifQ.eyJpc3MiOiJodHRwczovL2xvY2FsaG9zdDo0NDM1My8iLCJleHAiOjE3NzMwNjU4NzQsImlhdCI6MTc3MzAzNzA3NCwiYXVkIjoiTWludm9pY2VBcGkiLCJzY29wZSI6Ik1pbnZvaWNlQXBpIiwianRpIjoiMmZiNmJlZmEtZGQwNS00ZjU2LWI5Y2YtZDdkMjk5ZDM0ZjNhIiwic3ViIjoiM2ExY2Y3ZTQtOWMyYi02MTkwLWExYjUtYmQ5OWI5NDM2OTFmIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiQWRtaW4iLCJlbWFpbCI6ImhpZW50dEBtaW52b2ljZS52biIsInJvbGUiOiJRdeG6o24gdHLhu4siLCJ0ZW5hbnRpZCI6IjNhMWNmN2U0LTlhZTktOGY2OS1mMjAxLTc1MzM0OGFhNDBiOCIsImdpdmVuX25hbWUiOiIwMzEzMzY0NTY2IiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjoiRmFsc2UiLCJlbWFpbF92ZXJpZmllZCI6IkZhbHNlIiwidW5pcXVlX25hbWUiOiJBZG1pbiIsIm9pX3Byc3QiOiJNaW52b2ljZUFwaV9BcHAiLCJjbGllbnRfaWQiOiJNaW52b2ljZUFwaV9BcHAiLCJvaV90a25faWQiOiIzYTFmZTM2Yi04ZTllLTEzYWMtNTEwOC05MzcxY2E1NjUyZjEifQ.AKiw7suYybmwruYTavz7kaJUo74UkTdqt_YeEKPZLg_vPY3cyhPEKxjIX1dJac7l3TsU1TKoaINBMd1uAgxjZD-_Y5iVozrOU0YHMfB3ckTBFW62KAxIzkJ23uEXut-dskBmXPnne6sUBe-WJS0deEm3DMhiNEtkZtnmIuIJwf9MpCThJzsXaPmas5PlrDegRFCw82KlWSSglcSM2dNrrPwZgVALfr4o-FO4kJvqqxwcplHLEYgdjw_HdpzUX6AUQjA6hl0D4YqPKfeEPpjIh4vTB3bAN1Dtn4ahEqOKrw9bpGCIHrULmdBAUDTl03GMdnpAp00cHeaWTpq5Aza-1w";
  const DEFAULT_XSRF =
    "CfDJ8EiX1iYPse5KlIhd39kSFE1O7mBbGaJXgGJsoboba61iTv3UHyEEDA-0KjWXip0EjLGLU2ITG2LRO3p_UEaM6kRrwOO6gnneEhfRoRdnXa5tPN_HMEqBAINbvYVOHJHwliwGdxGpczOjlmQ6TD70NgVYS_NGnjNdEQbpSDp4XNreO36SLsUBGPfCgD0bdJSBTQ";
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState({
    totalFetched: 0,
    updateSuccess: 0,
    updateFail: 0,
  });

  const handleBulkUpdateVoucherDate = async (e) => {
    e.preventDefault();
    const tax = taxCode.trim();
    const symbolId = voucherSymbolId.trim();
    const bearer = DEFAULT_BEARER.trim();
    const xsrf = DEFAULT_XSRF.trim();

    if (!tax || !symbolId || !newDate) {
      toast.error(
        <ToastNotify
          status={-1}
          message="Vui lòng nhập đủ: Mã số thuế, Voucher Symbol ID và ngày mới."
        />,
        { style: styleError }
      );
      return;
    }

    const baseUrl = `https://${tax}.mtncn.minvoice.vn`;
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Language":
        "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
      Authorization: bearer.startsWith("Bearer ")
        ? bearer
        : `Bearer ${bearer}`,
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Origin: baseUrl,
      Pragma: "no-cache",
      Referer: `${baseUrl}/chung-tu`,
      RequestVerificationToken: xsrf,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      __tenant: tax,
    };

    setLoading(true);
    setLog({ totalFetched: 0, updateSuccess: 0, updateFail: 0 });

    try {
      const pageSize = 50;
      const allItems = [];
      let skipCount = 0;

      // Lấy toàn bộ danh sách chứng từ theo voucherSymbolId và status=0
      while (true) {
        const res = await axios.get(`${baseUrl}/api/app/voucher`, {
          params: {
            maxResultCount: pageSize,
            skipCount,
            status: 0,
            voucherSymbolId: symbolId,
          },
          headers,
        });

        const totalCount = res?.data?.totalCount ?? 0;
        const items = res?.data?.items ?? [];

        allItems.push(...items);
        setLog((prev) => ({
          ...prev,
          totalFetched: allItems.length,
        }));

        if (
          items.length === 0 ||
          items.length < pageSize ||
          allItems.length >= totalCount
        ) {
          break;
        }
        skipCount += pageSize;
      }

      if (allItems.length === 0) {
        toast.info(
          <ToastNotify
            status={0}
            message="Không tìm thấy chứng từ nào để cập nhật."
          />,
          { style: styleSuccess }
        );
        setLoading(false);
        return;
      }

      let updateSuccess = 0;
      let updateFail = 0;

      const voucherDateIso = `${newDate}T00:00:00`;

      for (const item of allItems) {
        if (!item.id) continue;
        const body = {
          ...item,
          voucherDate: voucherDateIso,
        };
        try {
          await axios.put(`${baseUrl}/api/app/voucher/${item.id}`, body, {
            headers,
          });
          updateSuccess += 1;
        } catch (err) {
          updateFail += 1;
          console.error(
            "Lỗi cập nhật chứng từ:",
            item.id,
            err?.response?.data || err.message
          );
        }
        setLog({
          totalFetched: allItems.length,
          updateSuccess,
          updateFail,
        });
      }

      toast.success(
        <ToastNotify
          status={0}
          message={`Cập nhật ngày chứng từ: ${updateSuccess} thành công, ${updateFail} thất bại (tổng ${allItems.length} bản ghi).`}
        />,
        { style: styleSuccess }
      );
    } catch (error) {
      console.error("Error bulk update voucher date:", error);
      toast.error(
        <ToastNotify
          status={-1}
          message={
            error?.response?.data?.message ||
            error?.message ||
            "Lỗi khi cập nhật chứng từ TNCN"
          }
        />,
        { style: styleError }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <ToastContainer />
      <h1 style={{ marginBottom: "20px" }}>
        Cập nhật ngày chứng từ TNCN hàng loạt
      </h1>
      <div
        style={{
          padding: "20px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #dee2e6",
          maxWidth: "700px",
        }}
      >
        <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
          Lấy danh sách chứng từ theo voucherSymbolId (phân trang 50) với
          status = 0, sau đó cập nhật trường ngày chứng từ ("voucherDate")
          sang ngày bạn chọn.
        </p>
        <form onSubmit={handleBulkUpdateVoucherDate}>
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Mã số thuế
            </label>
            <input
              type="text"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              placeholder="VD: 0313364566"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Voucher Symbol ID
            </label>
            <input
              type="text"
              value={voucherSymbolId}
              onChange={(e) => setVoucherSymbolId(e.target.value)}
              placeholder="VD: 3a1f9ba8-f2a8-e869-6c6c-18e417e4af8a"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Bearer token + XSRF
            </label>
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                backgroundColor: "#f1f3f5",
                padding: "8px",
                borderRadius: "4px",
              }}
            >
              Đang dùng sẵn Bearer và XSRF giống curl mẫu trong code. Khi cần
              thay, chỉnh trực tiếp hằng số <code>DEFAULT_BEARER</code> và{" "}
              <code>DEFAULT_XSRF</code> trong file <code>GetInvoiceFiles.jsx</code>.
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Ngày chứng từ mới
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </div>

          {log.totalFetched > 0 && (
            <div
              style={{
                marginBottom: "12px",
                fontSize: "13px",
                color: "#333",
              }}
            >
              Đã lấy: {log.totalFetched} chứng từ — Cập nhật thành công:{" "}
              {log.updateSuccess}, thất bại: {log.updateFail}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 20px",
              backgroundColor: loading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {loading
              ? "Đang xử lý (lấy danh sách + cập nhật)..."
              : "Lấy danh sách và cập nhật ngày chứng từ"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GetInvoiceFiles;

