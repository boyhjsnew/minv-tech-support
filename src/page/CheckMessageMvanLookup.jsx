import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  DEFAULT_AUTH,
  DEFAULT_BASE_URL,
  checkMessageMvanBatch,
  mapCheckMessageRowToExport,
  parseMessageRowsFromExcel,
} from "../Utils/CheckMessageMvan";

const SAMPLE_ROWS = [
  ["Mã thông điệp", "Ngày hóa đơn"],
  ["V0106026495248DF89133E6486A85EDF8C119D41FDA", "17/7/2026"],
  ["V0106026495248DF89133E6486A85EDF8C119D41FDA", "2026-03-10"],
];

function CheckMessageMvanLookup() {
  const fileInputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    td: "",
    ngay: "",
  });
  const [error, setError] = useState("");
  const [concurrency, setConcurrency] = useState(5);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [authorization, setAuthorization] = useState(DEFAULT_AUTH);

  const parseExcelFile = (file) => {
    setParsing(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        // cellDates + raw:true → ô ngày Excel thành Date; text "17/7/2026" vẫn giữ nguyên
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          defval: "",
        });

        if (!jsonData?.length) {
          setError("File Excel không có dữ liệu.");
          setRows([]);
          return;
        }

        const list = parseMessageRowsFromExcel(jsonData);
        if (!list.length) {
          setError(
            'Không đọc được dữ liệu. File cần 2 cột: "Mã thông điệp" và "Ngày hóa đơn" (YYYY-MM-DD).',
          );
          setRows([]);
          return;
        }

        setRows(list);
        setResults([]);
      } catch (err) {
        console.error(err);
        setError("Không đọc được file Excel.");
        setRows([]);
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
    const ws = XLSX.utils.aoa_to_sheet(SAMPLE_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Thong diep");
    XLSX.writeFile(wb, "mau_tra_cuu_thong_diep.xlsx");
  };

  const handleLookup = async () => {
    if (!rows.length) {
      setError("Vui lòng import file Excel (mã thông điệp + ngày hóa đơn).");
      return;
    }
    setLoading(true);
    setError("");
    setResults([]);
    setProgress({ current: 0, total: rows.length, td: "", ngay: "" });

    try {
      const list = await checkMessageMvanBatch(rows, {
        concurrency,
        delayMs: 80,
        baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
        authorization: authorization.trim() || DEFAULT_AUTH,
        onProgress: ({ current, total, td, ngay }) => {
          setProgress({ current, total, td, ngay });
        },
      });
      setResults(list);
    } catch (err) {
      setError(err?.message || "Lỗi khi tra cứu thông điệp.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!results.length) {
      setError("Chưa có kết quả để xuất.");
      return;
    }
    const exportRows = results.map(mapCheckMessageRowToExport);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ket qua");
    const name = `tra_cuu_thong_diep_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, name);
  };

  const resetAll = () => {
    setRows([]);
    setResults([]);
    setFileName("");
    setError("");
    setProgress({ current: 0, total: 0, td: "", ngay: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.length - successCount;

  return (
    <div
      style={{
        padding: "6rem 2rem 2rem",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <h2 style={{ marginBottom: "8px" }}>Tra cứu thông điệp MVAN</h2>
      <p style={{ color: "#555", marginBottom: "20px", fontSize: "14px" }}>
        Import Excel 2 cột <strong>Mã thông điệp</strong> +{" "}
        <strong>Ngày hóa đơn</strong> (vd <code>17/7/2026</code> hoặc{" "}
        <code>2026-07-17</code>) → tự format thành{" "}
        <code>ngay=YYYY-MM-DD</code> theo curl → gọi hàng loạt{" "}
        <code>CheckMessageMVAN</code> → xuất Excel kết quả.
      </p>

      <div
        style={{
          marginBottom: "16px",
          padding: "14px",
          background: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: "13px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
            placeholder={DEFAULT_BASE_URL}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
            Authorization
          </label>
          <input
            type="text"
            value={authorization}
            onChange={(e) => setAuthorization(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: "13px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
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
            max={20}
            value={concurrency}
            onChange={(e) =>
              setConcurrency(
                Math.min(20, Math.max(1, Number(e.target.value) || 5)),
              )
            }
            disabled={loading}
            style={{ width: "52px", padding: "4px 6px" }}
          />
        </label>
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading || !rows.length}
        >
          {loading ? "Đang tra cứu..." : `Tra cứu (${rows.length})`}
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
          File: <strong>{fileName}</strong> — {rows.length} dòng
        </p>
      )}

      {loading && progress.total > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "13px", marginBottom: "4px" }}>
            {progress.current}/{progress.total} — {progress.td} / {progress.ngay}{" "}
            ({percent}%)
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
        <p style={{ fontSize: "13px", marginBottom: "8px" }}>
          Kết quả: <strong style={{ color: "#16a34a" }}>{successCount}</strong>{" "}
          thành công,{" "}
          <strong style={{ color: "#dc2626" }}>{failCount}</strong> thất bại
        </p>
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
                <th style={thStyle}>STT</th>
                <th style={thStyle}>Mã thông điệp</th>
                <th style={thStyle}>Ngày HĐ</th>
                <th style={thStyle}>API</th>
                <th style={thStyle}>Thông báo / Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => {
                const exp = mapCheckMessageRowToExport(row);
                return (
                  <tr
                    key={`${row.td}-${row.ngay}-${idx}`}
                    style={{
                      backgroundColor: row.ok ? "#f0fdf4" : "#fef2f2",
                    }}
                  >
                    <td style={tdStyle}>{idx + 1}</td>
                    <td style={tdStyle}>
                      <code style={{ fontSize: "11px" }}>{exp["Mã thông điệp"]}</code>
                    </td>
                    <td style={tdStyle}>{exp["Ngày hóa đơn"]}</td>
                    <td style={tdStyle}>{exp["Trạng thái gọi API"]}</td>
                    <td style={tdStyle}>
                      <div>{exp["Thông báo"] || "—"}</div>
                      {exp["Kết quả (JSON)"] && (
                        <details style={{ marginTop: "4px" }}>
                          <summary style={{ cursor: "pointer", fontSize: "12px" }}>
                            Xem JSON
                          </summary>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              fontSize: "11px",
                              margin: "6px 0 0",
                              maxHeight: "160px",
                              overflow: "auto",
                            }}
                          >
                            {exp["Kết quả (JSON)"]}
                          </pre>
                        </details>
                      )}
                    </td>
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
  whiteSpace: "nowrap",
};
const tdStyle = {
  border: "1px solid #eee",
  padding: "8px",
  verticalAlign: "top",
};

export default CheckMessageMvanLookup;
