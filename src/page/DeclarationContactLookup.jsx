import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  lookupDeclarationContact,
  mapDeclarationContactToExport,
  parseTaxCodesFromExcel,
} from "../Utils/DeclarationContactLookup";
import "./GdtTaxStatusLookup.css";

const SAMPLE_MSTS = [["1702325579"], ["8600676387-001"]];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("vi-VN");
}

function DeclarationContactLookup() {
  const fileInputRef = useRef(null);
  const loadingRef = useRef(false);
  const exportRowsRef = useRef([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [results, setResults] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0, mst: "" });

  const stats = useMemo(() => {
    const finished = results.filter((row) => row && !row.pending);
    return {
      total: results.length,
      success: finished.filter((row) => row.success).length,
      failed: finished.filter((row) => !row.success).length,
      pending: results.filter((row) => row?.pending).length,
    };
  }, [results]);

  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const parseExcel = (file) => {
    setParsing(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target.result), {
          type: "array",
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          raw: false,
          defval: "",
        });
        const list = parseTaxCodesFromExcel(rows);
        if (!list.length) {
          throw new Error(
            'Không tìm thấy MST. File cần có cột "Mã số thuế" hoặc MST ở cột đầu.',
          );
        }
        setTaxCodes(list);
        setResults([]);
        exportRowsRef.current = [];
        setDone(false);
      } catch (err) {
        setTaxCodes([]);
        setError(err?.message || "Không đọc được file Excel.");
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      setError("Không mở được file Excel.");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseExcel(file);
  };

  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([["Mã số thuế"], ...SAMPLE_MSTS]);
    sheet["!cols"] = [{ wch: 22 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Danh sách MST");
    XLSX.writeFile(workbook, "mau_tra_cuu_email_dien_thoai.xlsx");
  };

  const runLookup = async () => {
    if (loadingRef.current || !taxCodes.length) return;
    loadingRef.current = true;
    setLoading(true);
    setDone(false);
    setError("");
    setProgress({ current: 0, total: taxCodes.length, mst: "" });

    const rows = taxCodes.map((mst) => ({
      mst,
      pending: true,
      success: false,
      version: "",
      declarationType: "",
      email: "",
      phone: "",
      declarationDate: "",
      error: "",
    }));
    setResults(rows);

    for (let index = 0; index < taxCodes.length; index += 1) {
      const mst = taxCodes[index];
      setProgress({ current: index, total: taxCodes.length, mst });
      const row = await lookupDeclarationContact(mst);
      rows[index] = { ...row, pending: false };
      exportRowsRef.current = [...rows];
      setResults([...rows]);
      setProgress({
        current: index + 1,
        total: taxCodes.length,
        mst,
      });
    }

    exportRowsRef.current = [...rows];
    setDone(true);
    setLoading(false);
    loadingRef.current = false;
  };

  const exportExcel = () => {
    const ready = exportRowsRef.current.filter((row) => !row.pending);
    if (!ready.length) {
      setError("Chưa có kết quả để xuất Excel.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(
      ready.map(mapDeclarationContactToExport),
    );
    sheet["!cols"] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 36 },
      { wch: 18 },
      { wch: 24 },
      { wch: 70 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Email điện thoại");
    XLSX.writeFile(
      workbook,
      `email_dien_thoai_to_khai_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const reset = () => {
    if (loadingRef.current) return;
    setTaxCodes([]);
    setResults([]);
    setFileName("");
    setDone(false);
    setError("");
    setProgress({ current: 0, total: 0, mst: "" });
    exportRowsRef.current = [];
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="gdt-page">
      <header className="gdt-hero">
        <h1>Tra cứu email & điện thoại theo tờ khai</h1>
        <p>
          Import danh sách MST → tự nhận diện hóa đơn 1.0/2.0 → lấy thông tin
          tờ khai mới nhất → xuất Excel.
        </p>
      </header>

      <div className="gdt-steps">
        <div className={`gdt-step ${taxCodes.length ? "done" : "active"}`}>
          <span className="gdt-step-num">1</span>
          Import Excel MST
        </div>
        <div className={`gdt-step ${loading ? "active" : done ? "done" : ""}`}>
          <span className="gdt-step-num">2</span>
          Tra cứu tờ khai
        </div>
        <div className={`gdt-step ${done ? "done" : ""}`}>
          <span className="gdt-step-num">3</span>
          Xuất Excel
        </div>
      </div>

      <section className="gdt-card">
        <div className="gdt-card-head">
          <h2>Dữ liệu đầu vào</h2>
          <span>Backend: localhost:3001</span>
        </div>
        <div className="gdt-card-body">
          <div className="gdt-drop">
            <strong>Chọn file Excel danh sách mã số thuế</strong>
            <p>Cột “Mã số thuế” hoặc cột đầu tiên. Hệ thống tự loại trùng.</p>
            <div
              className="gdt-actions"
              style={{ justifyContent: "center", marginTop: 0 }}
            >
              <button
                type="button"
                className="gdt-btn gdt-btn-secondary"
                onClick={downloadTemplate}
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
                <strong>{taxCodes.length}</strong> MST (đã loại trùng)
              </span>
            </div>
          )}

          <div className="gdt-actions">
            <button
              type="button"
              className="gdt-btn gdt-btn-primary"
              onClick={runLookup}
              disabled={loading || !taxCodes.length}
            >
              {loading
                ? `Đang tra cứu… ${percent}%`
                : `Bắt đầu tra cứu${taxCodes.length ? ` (${taxCodes.length})` : ""}`}
            </button>
            <button
              type="button"
              className="gdt-btn gdt-btn-success"
              onClick={exportExcel}
              disabled={!done || !results.length}
            >
              Xuất Excel
            </button>
            <button
              type="button"
              className="gdt-btn gdt-btn-ghost"
              onClick={reset}
              disabled={loading}
            >
              Làm mới
            </button>
          </div>

          {loading && (
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
          <div className="gdt-stats">
            {stats.total > 0 && (
              <>
                <span className="gdt-stat muted">{stats.total} MST</span>
                <span className="gdt-stat ok">{stats.success} thành công</span>
                {stats.failed > 0 && (
                  <span className="gdt-stat err">{stats.failed} lỗi</span>
                )}
                {stats.pending > 0 && (
                  <span className="gdt-stat muted">
                    {stats.pending} đang chờ
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="gdt-empty">
            Chưa có kết quả. Import Excel rồi bấm <strong>Bắt đầu tra cứu</strong>.
          </div>
        ) : (
          <div className="gdt-table-wrap">
            <table className="gdt-table">
              <thead>
                <tr>
                  <th>Mã số thuế</th>
                  <th>Phiên bản</th>
                  <th>Tờ khai</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Ngày tờ khai</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr
                    key={`${row.mst}-${index}`}
                    className={
                      row.pending ? "pending" : row.success ? "ok" : "fail"
                    }
                  >
                    <td className="gdt-mst">{row.mst}</td>
                    <td>{row.pending ? "…" : row.version || "—"}</td>
                    <td>
                      {row.pending ? "…" : row.declarationType || "—"}
                    </td>
                    <td>{row.pending ? "Đang chờ…" : row.email || "—"}</td>
                    <td>{row.pending ? "…" : row.phone || "—"}</td>
                    <td>
                      {row.pending ? "…" : formatDate(row.declarationDate)}
                    </td>
                    <td>
                      <span
                        className={`gdt-badge ${
                          row.pending ? "muted" : row.success ? "ok" : "fail"
                        }`}
                      >
                        {row.pending
                          ? "Đang chờ"
                          : row.success
                            ? "Thành công"
                            : "Thất bại"}
                      </span>
                      {!row.pending && row.error && (
                        <span className="gdt-status-full">{row.error}</span>
                      )}
                    </td>
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

export default DeclarationContactLookup;
