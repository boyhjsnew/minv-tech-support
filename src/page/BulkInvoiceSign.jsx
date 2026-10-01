import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MultiSelect } from "primereact/multiselect";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import {
  buildNetBaseUrl,
  extractXsrfTokenFromCookieString,
  fetchAccount20,
  getStoredCookies,
  normalizeTaxCode,
  openNetLoginAndListenCookies,
} from "../Utils/CreateUnitBulk";
import {
  PAGE_SIZE,
  fetchCounterStatusInvoice,
  fetchInvoiceSignTotalsForSerials,
  fetchTokenList,
  pickDefaultToken,
  pickSerialsFromCounter,
  runBulkSignLoop,
} from "../Utils/BulkInvoiceSign";
import "./CreateUnitBulk.css";

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatCksLabel(t) {
  const serial = String(t?.serialNumber || "").trim();
  const name = String(
    t?.subjectName || t?.venderShortcut || t?.vender || t?.user || "",
  ).trim();
  const star = t?.defaultSign ? " ★" : "";
  if (serial && name) return `${serial} — ${name}${star}`;
  if (serial) return `${serial}${star}`;
  return `${name || t?.id || "CKS"}${star}`;
}

function BulkInvoiceSign() {
  const stopRef = useRef(false);

  const [taxCode, setTaxCode] = useState("");
  const [account20, setAccount20] = useState(null);
  const [cookieStatus, setCookieStatus] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(false);

  const [seriesOptions, setSeriesOptions] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [counterSummary, setCounterSummary] = useState(null);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [tokens, setTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [loadingTokens, setLoadingTokens] = useState(false);

  const [previewTotal, setPreviewTotal] = useState(null);
  const [previewBySerial, setPreviewBySerial] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [signing, setSigning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const tax = normalizeTaxCode(taxCode);
  const netUrl = tax ? buildNetBaseUrl(tax) : "";
  const selectedToken =
    tokens.find((t) => t?.id === selectedTokenId) || null;
  const activeSerials = useMemo(
    () =>
      (Array.isArray(selectedSerials) ? selectedSerials : []).filter(Boolean),
    [selectedSerials],
  );

  const refreshCookieStatus = (mst = tax) => {
    if (!mst) {
      setCookieStatus("");
      return;
    }
    const cookies = getStoredCookies(mst);
    const xsrf = extractXsrfTokenFromCookieString(cookies);
    if (account20) {
      setCookieStatus(
        xsrf
          ? "Đã đăng nhập .net — sẵn sàng ký."
          : "Đã mở .net. Đăng nhập xong quay lại trang này.",
      );
      return;
    }
    setCookieStatus("Nhập MST → Lấy TK & mở .net → đăng nhập.");
  };

  useEffect(() => {
    refreshCookieStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxCode, account20]);

  const resolveAuth = () => {
    const cookies = getStoredCookies(tax);
    const xsrf = extractXsrfTokenFromCookieString(cookies);
    return { cookies, xsrf };
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
      if (!listen.window) {
        setError("Trình duyệt chặn popup. Cho phép popup rồi bấm Mở lại .net.");
      }

      toast.success(
        <ToastNotify
          status={0}
          message="Đã lấy TK/MK và mở .minvoice.net."
        />,
        { style: styleSuccess },
      );
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

  const handleLoadSeries = async () => {
    setError("");
    if (!tax) {
      setError("Vui lòng nhập MST.");
      return;
    }
    setLoadingSeries(true);
    setSeriesOptions([]);
    setSelectedSerials([]);
    setCounterSummary(null);
    try {
      const { cookies, xsrf } = resolveAuth();
      const counter = await fetchCounterStatusInvoice({
        taxCode: tax,
        cookieString: cookies,
        requestVerificationToken: xsrf,
      });
      const waiting = pickSerialsFromCounter(counter.details, "waitSign");
      const options = waiting.map((s) => ({
        label: `${s.invoiceSerial} — chờ ký: ${s.waitSign}`,
        value: s.invoiceSerial,
        waitSign: s.waitSign,
      }));
      setSeriesOptions(options);
      // Không tự chọn hết — để user chọn nếu muốn
      setSelectedSerials([]);
      setCounterSummary({
        totalWaitSign: counter.totalWaitSign,
        totalSending: counter.totalSending,
        totalSigned: counter.totalSigned,
      });
      toast.success(
        <ToastNotify
          status={0}
          message={
            options.length
              ? `Có ${options.length} ký hiệu chờ ký — hãy chọn ký hiệu cần xử lý`
              : "Không còn ký hiệu nào chờ ký"
          }
        />,
        { style: styleSuccess },
      );
      if (options.length === 0) {
        setError("Không có ký hiệu nào đang chờ ký (waitSign = 0).");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi khi lấy counter-status-invoice";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleLoadTokens = async () => {
    setError("");
    if (!tax) {
      setError("Vui lòng nhập MST.");
      return;
    }
    setLoadingTokens(true);
    try {
      const { cookies, xsrf } = resolveAuth();
      const list = await fetchTokenList({
        taxCode: tax,
        cookieString: cookies,
        requestVerificationToken: xsrf,
      });
      setTokens(list);
      const def = pickDefaultToken(list);
      setSelectedTokenId(def?.id || list[0]?.id || "");
      toast.success(
        <ToastNotify
          status={0}
          message={`Đã lấy ${list.length} chữ ký số`}
        />,
        { style: styleSuccess },
      );
      if (list.length === 0) {
        setError("Không tìm thấy CKS. Kiểm tra đã đăng nhập .net chưa.");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Không lấy được danh sách CKS";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setLoadingTokens(false);
    }
  };

  const handlePreview = async () => {
    setError("");
    if (!tax || activeSerials.length === 0 || !fromDate || !toDate) {
      setError("Nhập đủ MST, chọn ký hiệu, từ ngày, đến ngày.");
      return;
    }
    setLoadingPreview(true);
    setPreviewTotal(null);
    setPreviewBySerial([]);
    try {
      const { cookies, xsrf } = resolveAuth();
      const summary = await fetchInvoiceSignTotalsForSerials({
        taxCode: tax,
        invoiceSerials: activeSerials,
        fromDate,
        toDate,
        cookieString: cookies,
        requestVerificationToken: xsrf,
      });
      setPreviewTotal(summary.totalCount);
      setPreviewBySerial(summary.results);
      toast.success(
        <ToastNotify
          status={0}
          message={`Còn ${summary.totalCount} HĐ chờ ký`}
        />,
        { style: styleSuccess },
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Không lấy được danh sách HĐ chờ ký";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleStartSign = async () => {
    setError("");
    if (!tax || activeSerials.length === 0 || !fromDate || !toDate) {
      setError("Nhập đủ MST, chọn ký hiệu, từ ngày, đến ngày.");
      return;
    }
    if (!selectedToken) {
      setError("Chọn chữ ký số trước.");
      return;
    }

    stopRef.current = false;
    setSigning(true);
    setLogs([]);
    setProgress({
      round: 0,
      signedTotal: 0,
      totalRemaining: previewTotal,
      message: `Bắt đầu ký (${activeSerials.length} ký hiệu)…`,
    });

    try {
      const { cookies, xsrf } = resolveAuth();
      const result = await runBulkSignLoop({
        taxCode: tax,
        invoiceSerials: activeSerials,
        fromDate,
        toDate,
        tokenInfo: selectedToken,
        cookieString: cookies,
        requestVerificationToken: xsrf,
        pageSize: Number(pageSize) || PAGE_SIZE,
        shouldStop: () => stopRef.current,
        onProgress: (p) => setProgress({ ...p }),
      });

      setLogs(result.logs || []);
      setPreviewTotal(result.lastTotalCount ?? 0);

      toast.success(
        <ToastNotify
          status={0}
          message={
            result.stopped
              ? `Đã dừng. Đã gửi ký ${result.signedTotal} HĐ.`
              : `Hoàn tất. Đã gửi ký ${result.signedTotal} HĐ.`
          }
        />,
        { style: styleSuccess },
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Lỗi khi ký hàng loạt";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setSigning(false);
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    toast.success(
      <ToastNotify status={0} message="Sẽ dừng sau vòng ký hiện tại…" />,
      { style: styleSuccess },
    );
  };

  return (
    <div className="create-unit-page">
      <ToastContainer position="top-right" autoClose={3500} />

      <div className="create-unit-hero">
        <h1>Ký hóa đơn hàng loạt</h1>
        <p>
          Đăng nhập <code>{`{mst}.minvoice.net`}</code> → lấy ký hiệu{" "}
          <strong>chờ ký</strong> (counter) → chọn CKS → ký đến hết.
        </p>
      </div>

      {error ? <div className="create-unit-alert">{error}</div> : null}

      <section className="create-unit-card">
        <div className="create-unit-card-head">
          <h2>1. Đăng nhập .net</h2>
        </div>
        <div className="create-unit-card-body">
          <label className="create-unit-label" htmlFor="bis-tax">
            Mã số thuế
          </label>
          <div className="create-unit-row" style={{ marginBottom: "0.75rem" }}>
            <input
              id="bis-tax"
              className="create-unit-input"
              style={{ flex: "1 1 220px", maxWidth: "320px" }}
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              placeholder="VD: 0316612746 hoặc 0316612746-002"
              disabled={signing}
            />
          </div>
          {tax.includes("-") ? (
            <p className="create-unit-hint" style={{ marginTop: 0 }}>
              Domain: <code>{tax}.minvoice.net</code>
              {" · "}
              (bản không dấu: <code>{tax.replace(/-/g, "")}</code>)
            </p>
          ) : null}
          <div className="create-unit-actions">
            <button
              type="button"
              className="create-unit-btn create-unit-btn-primary"
              onClick={handleGetAccount20}
              disabled={loadingAccount || signing || !tax}
            >
              {loadingAccount ? "Đang lấy…" : "Lấy TK & mở .net"}
            </button>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-secondary"
              onClick={handleOpenNetAgain}
              disabled={signing || !tax}
            >
              Mở lại .net
            </button>
          </div>

          {account20 ? (
            <div className="create-unit-status ok" style={{ marginTop: "0.75rem" }}>
              <span className="create-unit-status-dot" />
              <div>
                TK: <strong>{account20.account}</strong> / MK:{" "}
                <strong>{account20.password}</strong>
                <br />
                <a href={netUrl} target="_blank" rel="noreferrer">
                  {netUrl}
                </a>
              </div>
            </div>
          ) : null}

          <p className="create-unit-hint">{cookieStatus}</p>
        </div>
      </section>

      <section className="create-unit-card" style={{ marginTop: "1rem" }}>
        <div className="create-unit-card-head">
          <h2>2. Ký hiệu · CKS · Ngày</h2>
        </div>
        <div className="create-unit-card-body">
          <div className="create-unit-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-secondary"
              onClick={handleLoadSeries}
              disabled={loadingSeries || signing || !tax}
            >
              {loadingSeries ? "Đang lấy…" : "Lấy ký hiệu chờ ký"}
            </button>
            {seriesOptions.length > 0 ? (
              <>
                <button
                  type="button"
                  className="create-unit-btn create-unit-btn-ghost"
                  onClick={() =>
                    setSelectedSerials(seriesOptions.map((o) => o.value))
                  }
                  disabled={signing}
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  className="create-unit-btn create-unit-btn-ghost"
                  onClick={() => setSelectedSerials([])}
                  disabled={signing}
                >
                  Bỏ chọn
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="create-unit-btn create-unit-btn-secondary"
              onClick={handleLoadTokens}
              disabled={loadingTokens || signing || !tax}
            >
              {loadingTokens ? "Đang lấy…" : "Lấy CKS"}
            </button>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-ghost"
              onClick={handlePreview}
              disabled={
                loadingPreview || signing || !tax || activeSerials.length === 0
              }
            >
              {loadingPreview ? "Đang đếm…" : "Đếm HĐ chờ ký"}
            </button>
          </div>

          <label
            className="create-unit-label"
            htmlFor="bis-serial-multi"
            style={{ marginTop: 12 }}
          >
            Ký hiệu chờ ký — chọn nếu muốn ({activeSerials.length}
            {seriesOptions.length ? `/${seriesOptions.length}` : ""})
          </label>
          <MultiSelect
            inputId="bis-serial-multi"
            value={selectedSerials}
            options={seriesOptions}
            onChange={(e) =>
              setSelectedSerials(Array.isArray(e.value) ? e.value : [])
            }
            optionLabel="label"
            optionValue="value"
            placeholder={
              seriesOptions.length === 0
                ? "Bấm Lấy ký hiệu chờ ký…"
                : "Chọn một hoặc nhiều ký hiệu…"
            }
            filter
            filterBy="label,value"
            filterPlaceholder="Tìm…"
            display="chip"
            showClear
            showSelectAll
            selectAllLabel="Chọn tất cả"
            emptyMessage="Không có ký hiệu chờ ký"
            emptyFilterMessage="Không tìm thấy"
            disabled={seriesOptions.length === 0 || signing}
            className="w-full"
            panelStyle={{ maxHeight: "360px" }}
            style={{ width: "100%", maxWidth: 640 }}
            maxSelectedLabels={4}
            selectedItemsLabel="{0} ký hiệu đã chọn"
          />
          <p className="create-unit-hint" style={{ marginTop: 6 }}>
            Lấy danh sách từ counter (<code>waitSign &gt; 0</code>), rồi chọn
            ký hiệu cần ký (hoặc Chọn tất cả).
          </p>
          {counterSummary ? (
            <p className="create-unit-hint" style={{ marginTop: 4 }}>
              Counter: chờ ký <strong>{counterSummary.totalWaitSign}</strong> ·
              đang gửi <strong>{counterSummary.totalSending}</strong> · đã ký{" "}
              <strong>{counterSummary.totalSigned}</strong>
            </p>
          ) : null}

          {tokens.length > 0 ? (
            <>
              <label
                className="create-unit-label"
                htmlFor="bis-token"
                style={{ marginTop: 12 }}
              >
                Chữ ký số (serial)
              </label>
              <select
                id="bis-token"
                className="create-unit-input"
                value={selectedTokenId}
                onChange={(e) => setSelectedTokenId(e.target.value)}
                disabled={signing}
                style={{ width: "100%", maxWidth: 640, marginTop: 4 }}
              >
                {tokens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatCksLabel(t)}
                  </option>
                ))}
              </select>
              {selectedToken?.serialNumber ? (
                <p className="create-unit-hint" style={{ marginTop: 6 }}>
                  Serial đang chọn:{" "}
                  <code>{selectedToken.serialNumber}</code>
                  {selectedToken.venderShortcut
                    ? ` · ${selectedToken.venderShortcut}`
                    : ""}
                </p>
              ) : null}
            </>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.75rem",
              marginTop: 12,
              maxWidth: 640,
            }}
          >
            <div>
              <label className="create-unit-label" htmlFor="bis-from">
                Từ ngày
              </label>
              <input
                id="bis-from"
                className="create-unit-input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={signing}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="create-unit-label" htmlFor="bis-to">
                Đến ngày
              </label>
              <input
                id="bis-to"
                className="create-unit-input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={signing}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="create-unit-label" htmlFor="bis-ps">
                HĐ / vòng
              </label>
              <input
                id="bis-ps"
                className="create-unit-input"
                type="number"
                min={1}
                max={500}
                value={pageSize}
                onChange={(e) =>
                  setPageSize(Number(e.target.value) || PAGE_SIZE)
                }
                disabled={signing}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {previewTotal != null ? (
            <div className="create-unit-status ok" style={{ marginTop: "0.75rem" }}>
              <span className="create-unit-status-dot" />
              <div>
                Còn <strong>{previewTotal}</strong> HĐ chờ ký
                {previewBySerial.length > 0 ? (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {previewBySerial.map((r) => (
                      <li key={r.serial}>
                        <code>{r.serial}</code>:{" "}
                        <strong>{r.totalCount}</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="create-unit-card" style={{ marginTop: "1rem" }}>
        <div className="create-unit-card-head">
          <h2>3. Ký</h2>
        </div>
        <div className="create-unit-card-body">
          <div className="create-unit-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-success"
              onClick={handleStartSign}
              disabled={
                signing ||
                !tax ||
                activeSerials.length === 0 ||
                !selectedToken
              }
            >
              {signing ? "Đang ký…" : "Bắt đầu ký"}
            </button>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-secondary"
              onClick={handleStop}
              disabled={!signing}
            >
              Dừng
            </button>
          </div>

          {progress ? (
            <div className="create-unit-status warn" style={{ marginTop: "0.75rem" }}>
              <span className="create-unit-status-dot" />
              <div>
                {progress.message}
                {progress.serialIndex != null && progress.serialTotal != null ? (
                  <>
                    <br />
                    <strong>
                      {progress.invoiceSerial} ({progress.serialIndex}/
                      {progress.serialTotal})
                    </strong>
                  </>
                ) : null}
                {progress.signedTotal != null ? (
                  <>
                    <br />
                    Đã gửi: <strong>{progress.signedTotal}</strong>
                    {progress.totalRemaining != null
                      ? ` · Còn: ${progress.totalRemaining}`
                      : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {logs.length > 0 ? (
            <div className="create-unit-table-wrap" style={{ marginTop: "1rem" }}>
              <table className="create-unit-table">
                <thead>
                  <tr>
                    <th>Vòng</th>
                    <th>Ký hiệu</th>
                    <th>OK</th>
                    <th>Đã ký</th>
                    <th>Còn</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, idx) => (
                    <tr
                      key={`${l.round}-${l.invoiceSerial || ""}-${idx}`}
                      className={l.ok ? "ok" : "fail"}
                    >
                      <td>{l.round}</td>
                      <td>
                        <code>{l.invoiceSerial || "—"}</code>
                      </td>
                      <td>{l.ok ? "✓" : "✗"}</td>
                      <td>{l.signed}</td>
                      <td>{l.remaining}</td>
                      <td>{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default BulkInvoiceSign;
