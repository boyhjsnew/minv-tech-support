import React, { useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  buildSaveRequest,
  parseInvoiceXmlFiles,
} from "../Utils/XmlInvoiceToSave";
import "./XmlInvoiceImport.css";

const DEFAULT_AUTH =
  "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=";

function buildAuth(token) {
  const t = (token || "").trim();
  if (!t) return DEFAULT_AUTH;
  if (/^Bear\s+/i.test(t) || /^Bearer\s+/i.test(t)) return t;
  return `Bear ${t}`;
}

function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("vi-VN");
}

function XmlInvoiceImport() {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [payloads, setPayloads] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxCode, setTaxCode] = useState("");
  const [authToken, setAuthToken] = useState(DEFAULT_AUTH);
  const [omitNumber, setOmitNumber] = useState(false);
  const [seriesInput, setSeriesInput] = useState("");
  const [saveLogs, setSaveLogs] = useState([]);

  const saveRequest = useMemo(
    () =>
      buildSaveRequest(payloads, {
        editmode: 1,
        series: (seriesInput || "").trim(),
        omitInvoiceNumber: omitNumber,
      }),
    [payloads, omitNumber, seriesInput],
  );

  const invoiceCount = saveRequest.data?.length || 0;

  const runParse = async (fileList) => {
    if (!fileList?.length) {
      setError("Chọn ít nhất 1 file XML.");
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    setSaveLogs([]);
    try {
      const { payloads: ps, summaries: sm, fileStats: st } =
        await parseInvoiceXmlFiles(fileList);
      setPayloads(ps);
      setSummaries(sm);
      const firstSeries = (ps[0]?.inv_invoiceSeries || "").trim();
      if (firstSeries) setSeriesInput(firstSeries);

      const fail = st.filter((f) => !f.ok);
      if (!ps.length) {
        setError(
          fail.length
            ? fail.map((f) => `${f.name}: ${f.error}`).join(" | ")
            : "Không tách được hoá đơn.",
        );
      } else {
        setInfo(
          `${ps.length} HĐ` +
            (fail.length ? ` · ${fail.length} file lỗi` : ""),
        );
      }
    } catch (err) {
      setError(err?.message || "Lỗi đọc XML.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilesChange = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setFiles(list);
    setPayloads([]);
    setSummaries([]);
    setSeriesInput("");
    setSaveLogs([]);
    await runParse(list);
  };

  const downloadJson = () => {
    if (!invoiceCount) return;
    const blob = new Blob([JSON.stringify(saveRequest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `save_invoices_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveApi = async () => {
    const tax = (taxCode || "").trim().replace(/\s+/g, "");
    if (!tax) {
      setError("Nhập MST.");
      return;
    }
    if (!(seriesInput || "").trim()) {
      setError("Nhập ký hiệu.");
      return;
    }
    if (!invoiceCount) {
      setError("Chưa có dữ liệu XML.");
      return;
    }

    setSaving(true);
    setError("");
    setSaveLogs([]);
    const domain = tax.endsWith("-998") ? ".minvoice.site" : ".minvoice.app";
    const url = `https://${tax}${domain}/api/InvoiceApi78/Save`;
    const headers = {
      Authorization: buildAuth(authToken),
      "Content-Type": "application/json",
      Accept: "*/*",
    };

    const logs = [];
    // Gửi từng HĐ: { editmode: 1, data: [ item ] }
    for (let i = 0; i < saveRequest.data.length; i += 1) {
      const item = saveRequest.data[i];
      const body = { editmode: 1, data: [item] };
      const label = `${item.inv_invoiceSeries || ""}-${item.inv_invoiceNumber ?? "auto"}`;
      try {
        const res = await axios.post(url, body, {
          headers,
          timeout: 60000,
          validateStatus: () => true,
        });
        const code = res?.data?.code;
        const ok =
          (code === "00" || code === 0 || code === "0" || res.status === 200) &&
          res.status < 400;
        logs.push({
          index: i + 1,
          label,
          ok,
          message:
            res?.data?.message ||
            res?.data?.Message ||
            (ok ? "OK" : `HTTP ${res.status}`),
        });
      } catch (err) {
        logs.push({
          index: i + 1,
          label,
          ok: false,
          message: err?.message || "Lỗi Save",
        });
      }
      setSaveLogs([...logs]);
    }

    const okCount = logs.filter((l) => l.ok).length;
    setInfo(`Save: ${okCount}/${logs.length} OK`);
    setSaving(false);
  };

  const resetAll = () => {
    setFiles([]);
    setPayloads([]);
    setSummaries([]);
    setError("");
    setInfo("");
    setSaveLogs([]);
    setSeriesInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="xis-page">
      <h1 className="xis-title">Tách XML → Save</h1>

      <div className="xis-bar">
        <label className="xis-btn xis-btn-primary xis-file">
          {loading
            ? "Đang đọc…"
            : files.length
              ? `${files.length} XML`
              : "Chọn XML"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            onChange={handleFilesChange}
            disabled={loading || saving}
          />
        </label>

        <input
          className="xis-input"
          value={seriesInput}
          onChange={(e) => setSeriesInput(e.target.value)}
          placeholder="Ký hiệu (1C26TLP)"
          disabled={loading || saving}
        />

        <input
          className="xis-input"
          value={taxCode}
          onChange={(e) => setTaxCode(e.target.value)}
          placeholder="MST"
          disabled={saving}
        />

        <label className="xis-check">
          <input
            type="checkbox"
            checked={omitNumber}
            onChange={(e) => setOmitNumber(e.target.checked)}
            disabled={loading || saving}
          />
          Bỏ số HĐ
        </label>

        <button
          type="button"
          className="xis-btn xis-btn-primary"
          onClick={handleSaveApi}
          disabled={saving || !invoiceCount}
        >
          {saving ? "…" : `Save (${invoiceCount})`}
        </button>

        <button
          type="button"
          className="xis-btn"
          onClick={downloadJson}
          disabled={!invoiceCount || loading || saving}
        >
          JSON
        </button>

        <button
          type="button"
          className="xis-btn"
          onClick={resetAll}
          disabled={loading || saving}
        >
          Reset
        </button>
      </div>

      <details className="xis-more">
        <summary>Token</summary>
        <input
          className="xis-input xis-input-full"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          disabled={saving}
        />
      </details>

      {(error || info) && (
        <div className={error ? "xis-msg err" : "xis-msg ok"}>
          {error || info}
        </div>
      )}

      {summaries.length > 0 && (
        <div className="xis-table-wrap">
          <table className="xis-table">
            <thead>
              <tr>
                <th>#</th>
                <th>KH</th>
                <th>Số</th>
                <th>Ngày</th>
                <th>Người mua</th>
                <th>Tiền</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, idx) => (
                <tr key={`${s.sourceFile}-${idx}`}>
                  <td>{idx + 1}</td>
                  <td>{(seriesInput || "").trim() || s.series || "—"}</td>
                  <td>{omitNumber ? "—" : s.number ?? "—"}</td>
                  <td>{s.date || "—"}</td>
                  <td className="xis-clip">{s.buyer || "—"}</td>
                  <td>{formatMoney(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {saveLogs.length > 0 && (
        <div className="xis-logs">
          {saveLogs.map((l) => (
            <div key={l.index} className={l.ok ? "ok" : "err"}>
              #{l.index} {l.label}: {l.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default XmlInvoiceImport;
