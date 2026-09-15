import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getTthaiLabel,
  lookupGdtTaxStatusBatch,
  mapGdtRowToExport,
  parseMstListFromExcelRows,
} from "../Utils/GdtTaxStatus";
import "./GdtTaxStatusLookup.css";

const SAMPLE_MSTS = [["0311980954"], ["0106026495"], ["3603253486"]];

function getStatusTone(row) {
  if (!row || row.pending) return "muted";
  if (row.error) return "fail";
  const code = String(row.tthai ?? "")
    .trim()
    .padStart(2, "0");
  if (["00", "04"].includes(code)) return "ok";
  if (["05", "02", "09"].includes(code)) return "warn";
  if (["01", "03", "06", "07"].includes(code)) return "fail";
  return "muted";
}

function getStatusShort(row) {
  if (!row || row.pending) return "Đang tra cứu…";
  if (row.error) return "Lỗi";
  const code = String(row.tthai ?? "")
    .trim()
    .padStart(2, "0");
  const map = {
    "00": "Đang hoạt động",
    "01": "Ngừng HĐ (đã HT)",
    "02": "Chuyển CQT",
    "03": "Ngừng HĐ (chưa HT)",
    "04": "Đang hoạt động",
    "05": "Tạm ngừng KD",
    "06": "Không HĐ tại ĐC",
    "07": "Chờ phá sản",
    "09": "Chờ xác minh",
  };
  return map[code] || `Mã ${code}`;
}

function GdtTaxStatusLookup() {
  const fileInputRef = useRef(null);
  const [mstList, setMstList] = useState([]);
  const [results, setResults] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, mst: "" });
  const [error, setError] = useState("");
  const [concurrency, setConcurrency] = useState(4);

  const step1Done = mstList.length > 0;
  const step2Done = results.some((r) => r && !r.pending);
  const step3Done = results.length > 0 && !loading && results.every((r) => !r.pending);

  const stats = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let fail = 0;
    let pending = 0;
    for (const row of results) {
      const tone = getStatusTone(row);
      if (tone === "ok") ok += 1;
      else if (tone === "warn") warn += 1;
      else if (tone === "fail") fail += 1;
      else if (row?.pending) pending += 1;
    }
    return { ok, warn, fail, pending, total: results.length };
  }, [results]);

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
    XLSX.writeFile(wb, "mau_tra_cuu_tinh_trang_mst.xlsx");
  };

  const handleLookup = async () => {
    if (!mstList.length) {
      setError("Vui lòng import file Excel chứa danh sách MST.");
      return;
    }
    setLoading(true);
    setError("");
    setProgress({ current: 0, total: mstList.length, mst: "" });
    setResults(
      mstList.map((mst) => ({
        mst,
        pending: true,
        error: "",
        tthai: "",
        tennnt: "",
      })),
    );

    try {
      const rows = await lookupGdtTaxStatusBatch(mstList, {
        concurrency,
        delayMs: 0,
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
    const ready = results.filter((r) => r && !r.pending);
    if (!ready.length) {
      setError("Chưa có kết quả để xuất.");
      return;
    }
    const exportRows = ready.map(mapGdtRowToExport);
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
    <div className="gdt-page">
      <header className="gdt-hero">
        <h1>Tra cứu tình trạng MST (GDT)</h1>
        <p>
          Import danh sách mã số thuế, tra cứu trực tiếp từ hệ thống hóa đơn
          điện tử Tổng cục Thuế. Kết quả cập nhật realtime và có thể xuất Excel.
        </p>
      </header>

      <div className="gdt-steps">
        <div
          className={`gdt-step ${step1Done ? "done" : "active"}`}
        >
          <span className="gdt-step-num">1</span>
          Import Excel MST
        </div>
        <div
          className={`gdt-step ${
            loading ? "active" : step2Done ? "done" : ""
          }`}
        >
          <span className="gdt-step-num">2</span>
          Tra cứu GDT
        </div>
        <div className={`gdt-step ${step3Done ? "done" : ""}`}>
          <span className="gdt-step-num">3</span>
          Xem & xuất kết quả
        </div>
      </div>

      <section className="gdt-card">
        <div className="gdt-card-head">
          <h2>Dữ liệu đầu vào</h2>
          <span>Nguồn: hoadondientu.gdt.gov.vn</span>
        </div>
        <div className="gdt-card-body">
          <div className="gdt-drop">
            <strong>Chọn file Excel danh sách MST</strong>
            <p>
              Cột <em>Mã số thuế</em> (hoặc cột đầu). Hệ thống tự loại trùng.
            </p>
            <div className="gdt-actions" style={{ justifyContent: "center", marginTop: 0 }}>
              <button
                type="button"
                className="gdt-btn gdt-btn-secondary"
                onClick={handleDownloadTemplate}
                disabled={loading}
              >
                Tải file mẫu
              </button>
              <label className="gdt-btn gdt-btn-primary gdt-btn-file">
                {parsing ? "Đang đọc file…" : "Chọn file Excel"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={parsing || loading}
                />
              </label>
            </div>
          </div>

          {fileName && (
            <div className="gdt-file-meta">
              <span>
                File: <strong>{fileName}</strong>
              </span>
              <span>
                <strong>{mstList.length}</strong> MST (đã loại trùng)
              </span>
            </div>
          )}

          <div className="gdt-actions">
            <button
              type="button"
              className="gdt-btn gdt-btn-primary"
              onClick={handleLookup}
              disabled={loading || !mstList.length}
            >
              {loading
                ? `Đang tra cứu… ${percent}%`
                : `Tra cứu${mstList.length ? ` (${mstList.length})` : ""}`}
            </button>
            <button
              type="button"
              className="gdt-btn gdt-btn-success"
              onClick={handleExportExcel}
              disabled={!results.some((r) => r && !r.pending)}
            >
              Xuất Excel
            </button>
            <button
              type="button"
              className="gdt-btn gdt-btn-ghost"
              onClick={resetAll}
              disabled={loading}
            >
              Làm mới
            </button>
            <label className="gdt-concurrency" title="Số request gọi song song (1–20)">
              Song song
              <input
                type="number"
                min={1}
                max={20}
                value={concurrency}
                onChange={(e) =>
                  setConcurrency(
                    Math.min(20, Math.max(1, Number(e.target.value) || 4)),
                  )
                }
                disabled={loading}
              />
            </label>
          </div>

          {loading && progress.total > 0 && (
            <div className="gdt-progress">
              <div className="gdt-progress-top">
                <span>
                  {progress.current}/{progress.total} — {progress.mst}
                </span>
                <span>{percent}%</span>
              </div>
              <div className="gdt-progress-bar">
                <div
                  className="gdt-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {error && <div className="gdt-alert">{error}</div>}
        </div>
      </section>

      <section className="gdt-panel">
        <div className="gdt-panel-head">
          <h3>Kết quả tra cứu</h3>
          {results.length > 0 && (
            <div className="gdt-stats">
              <span className="gdt-stat muted">{stats.total} MST</span>
              {stats.ok > 0 && (
                <span className="gdt-stat ok">{stats.ok} hoạt động</span>
              )}
              {stats.warn > 0 && (
                <span className="gdt-stat warn">{stats.warn} cảnh báo</span>
              )}
              {stats.fail > 0 && (
                <span className="gdt-stat err">{stats.fail} lỗi/ngừng</span>
              )}
              {stats.pending > 0 && (
                <span className="gdt-stat muted">{stats.pending} đang chạy</span>
              )}
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <div className="gdt-empty">
            Chưa có kết quả. Import Excel rồi bấm <strong>Tra cứu</strong>.
          </div>
        ) : (
          <div className="gdt-table-wrap">
            <table className="gdt-table">
              <thead>
                <tr>
                  <th>MST</th>
                  <th>Tình trạng</th>
                  <th>Tên NNT</th>
                  <th>Địa chỉ</th>
                  <th>CQT quản lý</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => {
                  const tone = getStatusTone(row);
                  const exp = row.pending
                    ? {
                        "Mã số thuế": row.mst,
                        "Tình trạng": "",
                        "Tên tổ chức, cá nhân": "",
                        "Địa chỉ": "",
                        "CQT quản lý": "",
                      }
                    : mapGdtRowToExport(row);
                  return (
                    <tr
                      key={`${row.mst}-${idx}`}
                      className={row.pending ? "pending" : tone}
                    >
                      <td className="gdt-mst">{exp["Mã số thuế"]}</td>
                      <td>
                        <span className={`gdt-badge ${tone}`}>
                          {getStatusShort(row)}
                        </span>
                        {!row.pending && !row.error && (
                          <span className="gdt-status-full">
                            {getTthaiLabel(row.tthai)}
                          </span>
                        )}
                        {!row.pending && row.error && (
                          <span className="gdt-status-full">{row.error}</span>
                        )}
                      </td>
                      <td>{exp["Tên tổ chức, cá nhân"] || "—"}</td>
                      <td>{exp["Địa chỉ"] || "—"}</td>
                      <td>{exp["CQT quản lý"] || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default GdtTaxStatusLookup;
