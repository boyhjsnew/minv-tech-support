import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  lookupGdtTaxStatusBatch,
  mapGdtRowToExport,
  parseMstListFromExcelRows,
} from "../Utils/GdtTaxStatus";

const SAMPLE_MSTS = [["0311980954"], ["0106026495"], ["3603253486"]];

function GdtTaxStatusLookup() {
  const fileInputRef = useRef(null);
  const [mstList, setMstList] = useState([]);
  const [results, setResults] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, mst: "" });
  const [error, setError] = useState("");
  const [concurrency, setConcurrency] = useState(8);

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
            'Không tìm thấy MST. File cần có cột "Mã số thuế" hoặc MST ở cột đầu.'
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
    XLSX.writeFile(wb, "mau_tra_cuu_tinh_trang_mst.xlsx");
  };

  const handleLookup = async () => {
    if (!mstList.length) {
      setError("Vui lòng import file Excel chứa danh sách MST.");
      return;
    }
    setLoading(true);
    setError("");
    setResults([]);
    setProgress({ current: 0, total: mstList.length, mst: "" });

    try {
      const rows = await lookupGdtTaxStatusBatch(mstList, {
        concurrency,
        delayMs: 0,
        onProgress: ({ current, total, mst }) => {
          setProgress({ current, total, mst });
        },
      });
      setResults(rows);
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
    const exportRows = results.map(mapGdtRowToExport);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tình trạng MST");
    const name = `tra_cuu_tinh_trang_mst_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      <h2 style={{ marginBottom: "8px" }}>Tra cứu tình trạng mã số thuế (GDT)</h2>
      <p style={{ color: "#555", marginBottom: "20px", fontSize: "14px" }}>
        Import Excel danh sách MST → tra cứu API GDT (mặc định{" "}
        <strong>8 request song song</strong>, không chờ giữa các MST) → xuất
        Excel. Mỗi request timeout tối đa 15s.
      </p>

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
        <label style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          Song song:
          <input
            type="number"
            min={1}
            max={20}
            value={concurrency}
            onChange={(e) =>
              setConcurrency(
                Math.min(20, Math.max(1, Number(e.target.value) || 8))
              )
            }
            disabled={loading}
            style={{ width: "52px", padding: "4px 6px" }}
            title="Số request GDT gọi cùng lúc (1–20). Tăng = nhanh hơn, có thể bị chặn nếu quá cao."
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
                <th style={thStyle}>MST</th>
                <th style={thStyle}>Tình trạng</th>
                <th style={thStyle}>Tên NNT</th>
                <th style={thStyle}>Địa chỉ</th>
                <th style={thStyle}>CQT quản lý</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => {
                const exp = mapGdtRowToExport(row);
                return (
                  <tr key={`${row.mst}-${idx}`}>
                    <td style={tdStyle}>{exp["Mã số thuế"]}</td>
                    <td style={tdStyle}>{exp["Tình trạng"]}</td>
                    <td style={tdStyle}>{exp["Tên tổ chức, cá nhân"]}</td>
                    <td style={tdStyle}>{exp["Địa chỉ"]}</td>
                    <td style={tdStyle}>{exp["CQT quản lý"]}</td>
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

export default GdtTaxStatusLookup;
