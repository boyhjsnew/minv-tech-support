import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  dedupeOrdersByCode,
  extractOrdersFromFiles,
  mapOrderRowToExport,
} from "../Utils/ExcelOrderMapping";
import "./ExcelOrderMapping.css";

function ExcelOrderMapping() {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileStats, setFileStats] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [missingOrderCodeFiles, setMissingOrderCodeFiles] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dedupe, setDedupe] = useState(true);

  const displayRows = useMemo(
    () => (dedupe ? dedupeOrdersByCode(rows) : rows),
    [rows, dedupe],
  );

  const handleFilesChange = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setFiles(list);
    setRows([]);
    setFileStats([]);
    setWarnings([]);
    setMissingOrderCodeFiles([]);
    setError("");
  };

  const handleProcess = async () => {
    if (!files.length) {
      setError("Vui lòng chọn ít nhất 1 file Excel.");
      return;
    }
    setLoading(true);
    setError("");
    setWarnings([]);
    setMissingOrderCodeFiles([]);
    try {
      const {
        rows: extracted,
        warnings: w,
        fileStats: stats,
        missingOrderCodeFiles: missing,
      } = await extractOrdersFromFiles(files);
      setRows(extracted);
      setWarnings(w);
      setFileStats(stats);
      setMissingOrderCodeFiles(missing || []);

      if ((missing || []).length > 0 && !extracted.length) {
        setError(
          `${missing.length} file không có cột "Mã đơn hàng": ${missing.join(", ")}`,
        );
      } else if ((missing || []).length > 0) {
        setError(
          `${missing.length} file không có cột "Mã đơn hàng" (đã bỏ qua): ${missing.join(", ")}. Các file còn lại đã đọc được ${extracted.length} dòng.`,
        );
      } else if (!extracted.length) {
        setError(
          'Không đọc được dòng nào. Kiểm tra file có cột "Mã đơn hàng" và có dữ liệu bên dưới header.',
        );
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Lỗi khi đọc Excel.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!displayRows.length) {
      setError("Chưa có dữ liệu để xuất.");
      return;
    }
    try {
      const exportRows = displayRows.map(mapOrderRowToExport);
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Đơn hàng");
      XLSX.writeFile(
        wb,
        `mapping_ma_don_hang_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      setError("");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Không xuất được Excel.");
    }
  };

  const resetAll = () => {
    setFiles([]);
    setRows([]);
    setFileStats([]);
    setWarnings([]);
    setMissingOrderCodeFiles([]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="eom-page">
      <header className="eom-hero">
        <h1>Mapping cột Excel — Mã đơn hàng</h1>
        <p>
          Upload nhiều file Excel. Hệ thống <strong>tìm theo tên cột</strong>{" "}
          <em>Mã đơn hàng</em> / <em>Ngày đặt hàng</em> — không phụ thuộc cột
          nằm ở vị trí nào (A/B/C…) hay dòng header.
        </p>
      </header>

      <section className="eom-card">
        <div className="eom-card-head">
          <h2>Upload file</h2>
          <span>Hỗ trợ .xlsx / .xls — nhiều file cùng lúc</span>
        </div>
        <div className="eom-card-body">
          <div className="eom-drop">
            <strong>Chọn một hoặc nhiều file Excel</strong>
            <p>
              Bắt buộc có cột <em>Mã đơn hàng</em>. Cột <em>Ngày đặt hàng</em>{" "}
              nếu có sẽ được lấy kèm.
            </p>
            <label className="eom-btn eom-btn-primary eom-btn-file">
              {files.length
                ? `Đã chọn ${files.length} file`
                : "Chọn file Excel"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleFilesChange}
                disabled={loading}
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="eom-file-list">
              {files.map((f) => {
                const st = fileStats.find((s) => s.name === f.name);
                return (
                  <div
                    key={f.name + f.size}
                    className={`eom-file-item ${st && !st.ok ? "fail" : ""}`}
                  >
                    <span>
                      {f.name}
                      {st?.mappedColumns ? (
                        <small
                          style={{
                            display: "block",
                            marginTop: 4,
                            fontWeight: 500,
                            opacity: 0.85,
                          }}
                        >
                          Map: {st.mappedColumns}
                        </small>
                      ) : null}
                    </span>
                    <span>
                      {st
                        ? st.missingOrderCode
                          ? 'Thiếu cột "Mã đơn hàng"'
                          : st.ok
                            ? `${st.count} dòng`
                            : st.error
                        : `${Math.round(f.size / 1024)} KB`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="eom-actions">
            <button
              type="button"
              className="eom-btn eom-btn-primary"
              onClick={handleProcess}
              disabled={loading || !files.length}
            >
              {loading ? "Đang đọc…" : "Đọc & mapping"}
            </button>
            <button
              type="button"
              className="eom-btn eom-btn-success"
              onClick={handleExport}
              disabled={!displayRows.length || loading}
            >
              Xuất Excel{displayRows.length ? ` (${displayRows.length})` : ""}
            </button>
            <button
              type="button"
              className="eom-btn eom-btn-ghost"
              onClick={resetAll}
              disabled={loading}
            >
              Làm mới
            </button>
            <label className="eom-check">
              <input
                type="checkbox"
                checked={dedupe}
                onChange={(e) => setDedupe(e.target.checked)}
                disabled={loading}
              />
              Loại trùng mã đơn
            </label>
          </div>

          {error && <div className="eom-alert">{error}</div>}

          {missingOrderCodeFiles.length > 0 && (
            <div className="eom-alert" style={{ marginTop: "0.75rem" }}>
              <strong>
                File không có cột &quot;Mã đơn hàng&quot; (
                {missingOrderCodeFiles.length}):
              </strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: "1.2rem" }}>
                {missingOrderCodeFiles.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <div style={{ marginTop: 6, fontWeight: 500 }}>
                Vui lòng kiểm tra lại tên cột trong Excel (ví dụ:{" "}
                <em>Mã đơn hàng</em>).
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="eom-warn">
              {warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="eom-panel">
        <div className="eom-panel-head">
          <h3>Kết quả</h3>
          <div className="eom-stats">
            <span className="eom-stat">{files.length} file</span>
            <span className="eom-stat ok">{displayRows.length} mã đơn</span>
            <button
              type="button"
              className="eom-btn eom-btn-success"
              onClick={handleExport}
              disabled={!displayRows.length || loading}
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
            >
              Xuất Excel
            </button>
          </div>
        </div>

        {displayRows.length === 0 ? (
          <div className="eom-empty">
            Chưa có dữ liệu. Upload file rồi bấm <strong>Đọc & mapping</strong>.
          </div>
        ) : (
          <div className="eom-table-wrap">
            <table className="eom-table">
              <thead>
                <tr>
                  <th>Mã đơn hàng</th>
                  <th>Ngày đặt hàng</th>
                  <th>File nguồn</th>
                  <th>Sheet</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={`${row.orderCode}-${idx}`}>
                    <td className="eom-code">{row.orderCode}</td>
                    <td>{row.orderDate || "—"}</td>
                    <td>{row.sourceFile || "—"}</td>
                    <td>{row.sheet || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default ExcelOrderMapping;
