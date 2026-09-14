import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getLast3MonthsRange,
  lookupInvoiceActivityBatch,
  mapInvoiceActivityToExport,
  parseMstListFromExcelRows,
} from "../Utils/InvoiceActivityLookup";

const SAMPLE_MSTS = [["0314047055"], ["0311980954"], ["0106026495"]];

function InvoiceActivityLookup() {
  const fileInputRef = useRef(null);
  const [mstList, setMstList] = useState([]);
  const [results, setResults] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, mst: "" });
  const [error, setError] = useState("");
  const [concurrency, setConcurrency] = useState(3);
  const [authToken, setAuthToken] = useState("");

  const range = getLast3MonthsRange();

  const parseExcelFile = (file) => {
    setParsing(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

        if (!jsonData?.length) {
          setError("File Excel không có dữ liệu.");
          setMstList([]);
          return;
        }

        const list = parseMstListFromExcelRows(jsonData);
        if (!list.length) {
          setError(
            'Không tìm thấy MST. File cần có cột "Mã số thuế" hoặc MST ở cột đầu.',
          );
          setMstList([]);
          return;
        }

        setMstList(list);
        setResults([]);
      } catch (err) {
        console.error(err);
        setError("Không đọc được file Excel.");
        setMstList([]);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      setError("Không mở được file.");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    parseExcelFile(file);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Mã số thuế"], ...SAMPLE_MSTS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách MST");
    XLSX.writeFile(wb, "mau_tra_cuu_hoat_dong_hoa_don.xlsx");
  };

  const handleLookup = async () => {
    if (!mstList.length) {
      setError("Vui lòng import file Excel chứa danh sách MST.");
      return;
    }
    setLoading(true);
    setError("");
    setProgress({ current: 0, total: mstList.length, mst: "" });
    // Seed bảng realtime — từng dòng cập nhật khi xong
    setResults(
      mstList.map((mst) => ({
        mst,
        seriesC26: [],
        seriesText: "",
        hasInvoiceLast3Months: false,
        isActive: false,
        domain: "",
        invoiceVersion: "",
        pending: true,
        error: "",
      })),
    );

    try {
      const rows = await lookupInvoiceActivityBatch(mstList, {
        concurrency,
        authToken,
        range,
        onProgress: ({ current, total, index, mst, row }) => {
          setProgress({ current, total, mst });
          setResults((prev) => {
            const next = [...prev];
            if (index >= 0 && index < next.length) {
              next[index] = { ...row, pending: false };
            }
            return next;
          });
        },
      });
      setResults(rows.map((r) => ({ ...r, pending: false })));
    } catch (err) {
      setError(err?.message || "Lỗi khi tra cứu.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!results.length) {
      setError("Chưa có kết quả để xuất.");
      return;
    }
    const exportRows = results.map(mapInvoiceActivityToExport);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hoạt động HĐ");
    const name = `tra_cuu_hoat_dong_hoa_don_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, name);
  };

  const resetAll = () => {
    setMstList([]);
    setResults([]);
    setFileName("");
    setError("");
    setProgress({ current: 0, total: 0, mst: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div style={{ padding: "6rem 2rem 2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "8px" }}>Tra cứu hoạt động hoá đơn</h2>
      <p style={{ color: "#555", marginBottom: "12px", fontSize: "14px" }}>
        Import Excel danh sách MST → lấy ký hiệu qua{" "}
        <code>GetTypeInvoiceSeries</code> (chỉ lấy{" "}
        <strong>1C26__</strong> / <strong>2C26__</strong>, ký hiệu không có{" "}
        <strong>C26</strong> thì bỏ qua), nếu có thì gọi{" "}
        <code>GetInvoices</code> trong 3 tháng gần nhất (
        {range.tuNgay} → {range.denngay}). Thử lần lượt domain{" "}
        <code>.minvoice.app</code> / <code>.minvoice.com.vn</code>.
      </p>
      <p style={{ color: "#666", marginBottom: "20px", fontSize: "13px" }}>
        <strong>Hoạt động hoá đơn = Có</strong> khi có ký hiệu C26 và đã xuất
        hoá đơn trong 3 tháng gần nhất.{" "}
        <strong>Phiên bản:</strong> .app có HĐ → 2.0, .com.vn có HĐ → 1.0.
        Bảng dưới cập nhật realtime từng MST.
      </p>

      <div style={{ marginBottom: "14px" }}>
        <label style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>
          Authorization (tuỳ chọn — để trống dùng token mặc định Bear O87316…)
        </label>
        <input
          type="text"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          disabled={loading}
          placeholder="Bear … hoặc chỉ token"
          style={{
            width: "100%",
            maxWidth: "640px",
            padding: "8px 10px",
            fontSize: "13px",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <button type="button" onClick={handleDownloadTemplate}>
          Tải file mẫu
        </button>
        <label
          style={{
            display: "inline-block",
            padding: "8px 14px",
            background: "#0069b4",
            color: "#fff",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          {parsing ? "Đang đọc file..." : "Chọn file Excel"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
            disabled={parsing || loading}
          />
        </label>
        <label
          style={{
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Song song:
          <input
            type="number"
            min={1}
            max={10}
            value={concurrency}
            onChange={(e) =>
              setConcurrency(
                Math.min(10, Math.max(1, Number(e.target.value) || 3)),
              )
            }
            disabled={loading}
            style={{ width: "52px", padding: "4px 6px" }}
            title="Số MST xử lý cùng lúc (1–10)."
          />
        </label>
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading || !mstList.length}
        >
          {loading ? "Đang tra cứu..." : `Tra cứu (${mstList.length} MST)`}
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={!results.length}
        >
          Xuất Excel kết quả
        </button>
        <button type="button" onClick={resetAll}>
          Làm mới
        </button>
      </div>

      {fileName && (
        <p style={{ fontSize: "13px", marginBottom: "8px" }}>
          File: <strong>{fileName}</strong> — {mstList.length} mã số thuế (đã
          loại trùng)
        </p>
      )}

      {loading && progress.total > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "13px", marginBottom: "4px" }}>
            {progress.current}/{progress.total} — {progress.mst} ({percent}%)
          </div>
          <div
            style={{
              height: "8px",
              background: "#e0e0e0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "#0069b4",
                transition: "width 0.2s",
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "#c62828", marginBottom: "12px" }}>{error}</div>
      )}

      {results.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={thStyle}>Mã số thuế</th>
                <th style={thStyle}>Ký hiệu C26 (1C26__/2C26__)</th>
                <th style={thStyle}>Xuất HĐ 3 tháng gần nhất</th>
                <th style={thStyle}>Hoạt động hoá đơn</th>
                <th style={thStyle}>Phiên bản hoá đơn</th>
                <th style={thStyle}>Domain</th>
                <th style={thStyle}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => {
                const exp = mapInvoiceActivityToExport(row);
                const rowStyle = row.pending
                  ? { ...tdStyle, color: "#888", fontStyle: "italic" }
                  : tdStyle;
                return (
                  <tr key={`${row.mst}-${idx}`}>
                    <td style={tdStyle}>{exp["Mã số thuế"]}</td>
                    <td style={rowStyle}>
                      {exp["Danh sách ký hiệu C26 (1C26__/2C26__)"]}
                    </td>
                    <td style={rowStyle}>
                      {exp["Xuất hoá đơn 3 tháng gần nhất"]}
                    </td>
                    <td style={rowStyle}>{exp["Hoạt động hoá đơn"]}</td>
                    <td style={rowStyle}>{exp["Phiên bản hoá đơn"]}</td>
                    <td style={rowStyle}>{exp.Domain}</td>
                    <td style={rowStyle}>{exp["Ghi chú"]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
};
const tdStyle = {
  border: "1px solid #eee",
  padding: "8px",
  verticalAlign: "top",
};

export default InvoiceActivityLookup;
