import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import {
  buildNetBaseUrl,
  createUnitBatch,
  extractXsrfTokenFromCookieString,
  fetchAccount20,
  getStoredCookies,
  mapCreateUnitRowToExport,
  normalizeTaxCode,
  openNetLoginAndListenCookies,
  parseUnitRowsFromExcel,
} from "../Utils/CreateUnitBulk";
import {
  generateGetCookiesScript,
  saveCookiesToStorage,
} from "../Utils/GetCookiesFromWindow";
import "./CreateUnitBulk.css";

const SAMPLE_ROWS = [
  ["Mã hàng", "Tên DVT"],
  ["DVT003", "Bộ"],
  ["DVT004", "Hộp"],
];

function CreateUnitBulk() {
  const fileInputRef = useRef(null);
  const [taxCode, setTaxCode] = useState("");
  const [account20, setAccount20] = useState(null);
  const [cookieStatus, setCookieStatus] = useState("");
  const [hasXsrf, setHasXsrf] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [manualCookie, setManualCookie] = useState("");
  const [manualXsrf, setManualXsrf] = useState("");

  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    code: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [concurrency, setConcurrency] = useState(3);

  const tax = normalizeTaxCode(taxCode);
  const netUrl = tax ? buildNetBaseUrl(tax) : "";
  const step1Done = Boolean(account20);
  const step2Done = rows.length > 0;
  const step3Active = step1Done && step2Done;

  const refreshCookieStatus = (mst = tax) => {
    if (!mst) {
      setCookieStatus("");
      setHasXsrf(false);
      return;
    }
    const cookies = (manualCookie || "").trim() || getStoredCookies(mst);
    const xsrfFromManual = (manualXsrf || "").trim();
    const xsrf =
      xsrfFromManual || extractXsrfTokenFromCookieString(cookies);
    setHasXsrf(Boolean(xsrf) || Boolean(account20));

    if (account20) {
      setCookieStatus(
        xsrf
          ? "Đã login 2.0 + có XSRF. Cookie phiên .net sẽ gửi kèm withCredentials."
          : "Đã login 2.0. Cookie phiên tab .net sẽ gửi tự động (withCredentials) — có thể tạo DVT luôn.",
      );
      return;
    }

    if (xsrf) {
      setCookieStatus("Đã có XSRF thủ công — sẵn sàng tạo DVT.");
      return;
    }

    setCookieStatus(
      "Nhập MST → Lấy TK 2.0 → đăng nhập tab .minvoice.net (cùng Chrome) → tạo DVT.",
    );
  };

  useEffect(() => {
    refreshCookieStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxCode, manualCookie, manualXsrf, account20]);

  const resolveAuth = () => {
    const cookies = (manualCookie || "").trim() || getStoredCookies(tax);
    const xsrf =
      (manualXsrf || "").trim() || extractXsrfTokenFromCookieString(cookies);
    return { cookies, xsrf };
  };

  const handleSaveManualAuth = () => {
    if (!tax) {
      setError("Vui lòng nhập MST trước.");
      return;
    }
    const cookieValue = (manualCookie || "").trim();
    const xsrfValue = (manualXsrf || "").trim();
    if (!cookieValue && !xsrfValue) {
      setError("Hãy dán Cookie hoặc XSRF-TOKEN từ trang 2.0.");
      return;
    }

    // Nếu chỉ dán XSRF, lưu dạng cookie tối giản để extract được
    const toStore =
      cookieValue ||
      (xsrfValue ? `XSRF-TOKEN=${encodeURIComponent(xsrfValue)}` : "");
    if (toStore) {
      saveCookiesToStorage(tax, toStore);
    }
    refreshCookieStatus(tax);
    toast.success(
      <ToastNotify status={0} message="Đã lưu cookie/XSRF cho MST này" />,
      { style: styleSuccess },
    );
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
      toast.success(<ToastNotify status={0} message="Đã copy" />, {
        style: styleSuccess,
      });
    } catch {
      toast.error(<ToastNotify status={-1} message="Không copy được" />, {
        style: styleError,
      });
    }
  };

  const handleGetAccount20 = async () => {
    setError("");
    setLoadingAccount(true);
    try {
      const data = await fetchAccount20(taxCode);
      setAccount20(data);
      setTaxCode(data.taxCode);

      const listen = openNetLoginAndListenCookies(data.taxCode, () => {
        refreshCookieStatus(data.taxCode);
      });

      toast.success(
        <ToastNotify
          status={0}
          message="Đã lấy TK/MK 2.0 và mở link .minvoice.net."
        />,
        { style: styleSuccess },
      );

      if (!listen.window) {
        setError(
          "Trình duyệt chặn popup. Cho phép popup rồi bấm mở lại link 2.0.",
        );
      }
    } catch (err) {
      const msg = err?.message || "Lỗi khi lấy tài khoản 2.0";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setLoadingAccount(false);
    }
  };

  const handleOpenNetAgain = () => {
    if (!tax) {
      setError("Vui lòng nhập MST trước.");
      return;
    }
    openNetLoginAndListenCookies(tax, () => refreshCookieStatus(tax));
  };

  const handleCopyCookieScript = () => {
    if (!tax) {
      setError("Vui lòng nhập MST trước.");
      return;
    }
    copyText(generateGetCookiesScript(tax));
  };

  const parseExcelFile = (file) => {
    setParsing(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: "",
        });

        if (!jsonData?.length) {
          setError("File Excel không có dữ liệu.");
          setRows([]);
          return;
        }

        const list = parseUnitRowsFromExcel(jsonData);
        if (!list.length) {
          setError(
            'Không đọc được dữ liệu. File cần 2 cột: "Mã hàng" và "Tên DVT".',
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
    XLSX.utils.book_append_sheet(wb, ws, "DVT");
    XLSX.writeFile(wb, "mau_tao_don_vi_tinh.xlsx");
  };

  const handleCreate = async () => {
    if (!tax) {
      setError("Vui lòng nhập mã số thuế.");
      return;
    }
    if (!rows.length) {
      setError("Vui lòng import file Excel (Mã hàng + Tên DVT).");
      return;
    }

    // Giống các API ngách 2.0 khác: dùng cookie phiên đăng nhập tab .net
    // (withCredentials: true). XSRF dán tay chỉ là tuỳ chọn bổ sung.
    const { cookies, xsrf } = resolveAuth();
    if ((manualCookie || "").trim() || (manualXsrf || "").trim()) {
      saveCookiesToStorage(
        tax,
        cookies || (xsrf ? `XSRF-TOKEN=${encodeURIComponent(xsrf)}` : ""),
      );
    }

    setLoading(true);
    setError("");
    setResults([]);
    setProgress({ current: 0, total: rows.length, code: "", name: "" });

    try {
      const list = await createUnitBatch(rows, {
        taxCode: tax,
        concurrency,
        delayMs: 120,
        cookieString: cookies,
        requestVerificationToken: xsrf,
        onProgress: ({ current, total, code, name }) => {
          setProgress({ current, total, code, name });
        },
      });
      setResults(list);
      const ok = list.filter((r) => r.ok).length;
      const fail = list.length - ok;
      toast.info(
        <ToastNotify
          status={0}
          message={`Tạo DVT: ${ok}/${list.length} thành công${
            fail ? `, ${fail} thất bại` : ""
          }`}
        />,
        { style: styleSuccess },
      );
      if (fail > 0 && ok === 0) {
        setError(
          "Tất cả request thất bại. Kiểm tra đã đăng nhập đúng tab https://" +
            tax +
            ".minvoice.net chưa (cùng Chrome profile).",
        );
      }
    } catch (err) {
      setError(err?.message || "Lỗi khi tạo đơn vị tính hàng loạt.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!results.length) {
      setError("Chưa có kết quả để xuất.");
      return;
    }
    const exportRows = results.map(mapCreateUnitRowToExport);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ket qua");
    XLSX.writeFile(
      wb,
      `tao_dvt_${tax || "mst"}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const resetAll = () => {
    setRows([]);
    setResults([]);
    setFileName("");
    setError("");
    setProgress({ current: 0, total: 0, code: "", name: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.length - successCount;
  const previewRows = results.length ? results : rows.slice(0, 50);

  return (
    <div className="create-unit-page">
      <ToastContainer />

      <header className="create-unit-hero">
        <h1>Tạo đơn vị tính hàng loạt</h1>
        <p>
          Đăng nhập app 2.0 theo MST, import Excel 2 cột (Mã hàng + Tên DVT), rồi
          tạo hàng loạt qua API <code>/api/api/app/unit</code>.
        </p>
      </header>

      <div className="create-unit-steps">
        <div
          className={`create-unit-step ${
            step1Done ? "done" : "active"
          }`}
        >
          <span className="create-unit-step-num">1</span>
          Đăng nhập 2.0
        </div>
        <div
          className={`create-unit-step ${
            step2Done ? "done" : step1Done ? "active" : ""
          }`}
        >
          <span className="create-unit-step-num">2</span>
          Import Excel
        </div>
        <div
          className={`create-unit-step ${step3Active ? "active" : ""}`}
        >
          <span className="create-unit-step-num">3</span>
          Tạo hàng loạt
        </div>
      </div>

      <div className="create-unit-grid">
        <section className="create-unit-card">
          <div className="create-unit-card-head">
            <h2>Bước 1 · Kết nối app 2.0</h2>
            <span>MST → TK/MK → cookie</span>
          </div>
          <div className="create-unit-card-body">
            <label className="create-unit-label" htmlFor="unit-tax-code">
              Mã số thuế
            </label>
            <div className="create-unit-row" style={{ marginBottom: "0.75rem" }}>
              <input
                id="unit-tax-code"
                className="create-unit-input"
                style={{ flex: "1 1 220px", maxWidth: "320px" }}
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                disabled={loading || loadingAccount}
                placeholder="0106026495 hoặc 0106026495-998"
              />
              <button
                type="button"
                className="create-unit-btn create-unit-btn-primary"
                onClick={handleGetAccount20}
                disabled={loadingAccount || !taxCode.trim()}
              >
                {loadingAccount ? "Đang lấy..." : "Lấy TK 2.0"}
              </button>
              <button
                type="button"
                className="create-unit-btn create-unit-btn-secondary"
                onClick={handleOpenNetAgain}
                disabled={!tax}
              >
                Mở link .net
              </button>
            </div>

            {netUrl && (
              <a
                className="create-unit-link"
                href={`${netUrl}/#/`}
                target="_blank"
                rel="noreferrer"
              >
                {netUrl}/#/
              </a>
            )}

            {account20 && (
              <div className="create-unit-creds">
                <div
                  className="create-unit-cred"
                  onClick={() => copyText(account20.account)}
                  title="Click để copy"
                >
                  <div>
                    <small>Tài khoản</small>
                    <strong>{account20.account}</strong>
                  </div>
                  <span className="create-unit-cred-copy">Copy</span>
                </div>
                <div
                  className="create-unit-cred"
                  onClick={() => copyText(account20.password)}
                  title="Click để copy"
                >
                  <div>
                    <small>Mật khẩu</small>
                    <strong>{account20.password}</strong>
                  </div>
                  <span className="create-unit-cred-copy">Copy</span>
                </div>
              </div>
            )}

            <div
              className={`create-unit-status ${
                account20 || hasXsrf ? "ok" : "warn"
              }`}
            >
              <span className="create-unit-status-dot" />
              <div>{cookieStatus || "Nhập MST và lấy tài khoản 2.0 để bắt đầu."}</div>
            </div>

            <div className="create-unit-actions">
              <button
                type="button"
                className="create-unit-btn create-unit-btn-ghost"
                onClick={handleOpenNetAgain}
                disabled={!tax}
              >
                Mở lại link .net
              </button>
            </div>
            <p className="create-unit-hint">
              Giống các API ngách khác: sau khi đăng nhập tab{" "}
              <code>https://{"{mst}"}.minvoice.net</code> trên cùng Chrome,
              request sẽ gửi cookie tự động bằng <code>withCredentials: true</code>.
              Không cần chạy script Console.
            </p>

            <details style={{ marginTop: "0.9rem" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.84rem",
                  color: "#5b6b7c",
                  fontWeight: 600,
                }}
              >
                Tuỳ chọn nâng cao: dán XSRF/cookie thủ công
              </summary>
              <div style={{ marginTop: "0.75rem" }}>
                <label className="create-unit-label" htmlFor="manual-xsrf">
                  XSRF-TOKEN
                </label>
                <input
                  id="manual-xsrf"
                  className="create-unit-input"
                  type="text"
                  value={manualXsrf}
                  onChange={(e) => setManualXsrf(e.target.value)}
                  placeholder="Chỉ dùng khi API báo lỗi anti-forgery"
                  disabled={loading}
                />
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <label className="create-unit-label" htmlFor="manual-cookie">
                  Cookie đầy đủ
                </label>
                <textarea
                  id="manual-cookie"
                  className="create-unit-input"
                  rows={3}
                  value={manualCookie}
                  onChange={(e) => setManualCookie(e.target.value)}
                  placeholder="Tuỳ chọn"
                  disabled={loading}
                  style={{ resize: "vertical", minHeight: "72px" }}
                />
              </div>
              <div className="create-unit-actions">
                <button
                  type="button"
                  className="create-unit-btn create-unit-btn-secondary"
                  onClick={handleSaveManualAuth}
                  disabled={!tax || loading}
                >
                  Lưu thủ công
                </button>
                <button
                  type="button"
                  className="create-unit-btn create-unit-btn-ghost"
                  onClick={handleCopyCookieScript}
                  disabled={!tax}
                >
                  Copy script (hiếm khi cần)
                </button>
              </div>
            </details>
          </div>
        </section>

        <section className="create-unit-card">
          <div className="create-unit-card-head">
            <h2>Bước 2 · Import Excel</h2>
            <span>2 cột: Mã hàng, Tên DVT</span>
          </div>
          <div className="create-unit-card-body">
            <div className="create-unit-drop">
              <strong>Kéo thả hoặc chọn file Excel</strong>
              <p>Hỗ trợ .xlsx / .xls · có thể tải file mẫu trước</p>
              <div className="create-unit-actions" style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  className="create-unit-btn create-unit-btn-ghost"
                  onClick={handleDownloadTemplate}
                >
                  Tải file mẫu
                </button>
                <label className="create-unit-btn create-unit-btn-primary">
                  {parsing ? "Đang đọc..." : "Chọn file Excel"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    disabled={parsing || loading}
                  />
                </label>
              </div>
            </div>

            {fileName && (
              <div className="create-unit-file-meta">
                File: <strong>{fileName}</strong> · {rows.length} dòng hợp lệ
              </div>
            )}

            <div className="create-unit-actions">
              <label className="create-unit-concurrency">
                Song song
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
                />
              </label>
              <button
                type="button"
                className="create-unit-btn create-unit-btn-success"
                onClick={handleCreate}
                disabled={loading || !rows.length || !tax}
              >
                {loading
                  ? "Đang tạo..."
                  : `Tạo hàng loạt${rows.length ? ` (${rows.length})` : ""}`}
              </button>
              <button
                type="button"
                className="create-unit-btn create-unit-btn-secondary"
                onClick={handleExportExcel}
                disabled={!results.length}
              >
                Xuất kết quả
              </button>
              <button
                type="button"
                className="create-unit-btn create-unit-btn-ghost"
                onClick={resetAll}
              >
                Làm mới
              </button>
            </div>

            {loading && progress.total > 0 && (
              <div className="create-unit-progress">
                <div className="create-unit-progress-top">
                  <span>
                    {progress.current}/{progress.total} · {progress.code} /{" "}
                    {progress.name}
                  </span>
                  <span>{percent}%</span>
                </div>
                <div className="create-unit-progress-bar">
                  <div
                    className="create-unit-progress-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            {error && <div className="create-unit-alert">{error}</div>}
          </div>
        </section>
      </div>

      {(rows.length > 0 || results.length > 0) && (
        <section className="create-unit-panel">
          <div className="create-unit-panel-head">
            <h3>
              {results.length > 0
                ? `Kết quả tạo DVT (${results.length})`
                : `Xem trước dữ liệu (${rows.length})`}
            </h3>
            {results.length > 0 && (
              <div className="create-unit-stats">
                <span className="create-unit-stat ok">
                  {successCount} thành công
                </span>
                <span className="create-unit-stat err">
                  {failCount} thất bại
                </span>
              </div>
            )}
          </div>
          <div className="create-unit-table-wrap">
            <table className="create-unit-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã hàng</th>
                  <th>Tên DVT</th>
                  {results.length > 0 && <th>Trạng thái</th>}
                  {results.length > 0 && <th>Thông báo</th>}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  if (results.length > 0) {
                    const exp = mapCreateUnitRowToExport(row);
                    return (
                      <tr
                        key={`${row.code}-${idx}`}
                        className={row.ok ? "ok" : "fail"}
                      >
                        <td>{idx + 1}</td>
                        <td>{exp["Mã hàng"]}</td>
                        <td>{exp["Tên DVT"]}</td>
                        <td>
                          <span
                            className={`create-unit-badge ${
                              row.ok ? "ok" : "fail"
                            }`}
                          >
                            {exp["Trạng thái"]}
                          </span>
                        </td>
                        <td>{exp["Thông báo"] || "—"}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`${row.code}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default CreateUnitBulk;
