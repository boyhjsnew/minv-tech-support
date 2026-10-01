import React, { useMemo, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MultiSelect } from "primereact/multiselect";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import {
  normalizeTaxCode,
  taxCodeWithoutDash,
} from "../Utils/CreateUnitBulk";
import {
  buildComVnBaseUrl,
  copySpecialConfigs,
  fetchSpecialConfig10,
  loginMinvoice10,
} from "../Utils/CopySpecialConfig10";
import "./CreateUnitBulk.css";

function itemKey(item, idx) {
  return item?.id || item?.ttkhac_id || `${item?.ttruong || "f"}-${idx}`;
}

function CopySpecialConfig10() {
  const stopRef = useRef(false);

  const [sourceTax, setSourceTax] = useState("");
  const [targetTax, setTargetTax] = useState("");
  const [items, setItems] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const sourceNorm = normalizeTaxCode(sourceTax);
  const targetNorm = normalizeTaxCode(targetTax);
  const sourceComVn = taxCodeWithoutDash(sourceTax);
  const targetComVn = taxCodeWithoutDash(targetTax);

  const options = useMemo(
    () =>
      items.map((it, idx) => ({
        label: `${it.ttruong || "—"} — ${it.label || ""} (${it.parrent || ""})`,
        value: itemKey(it, idx),
      })),
    [items],
  );

  const selectedItems = useMemo(() => {
    const set = new Set(selectedKeys);
    return items.filter((it, idx) => set.has(itemKey(it, idx)));
  }, [items, selectedKeys]);

  const handleFetch = async () => {
    setError("");
    if (!sourceNorm) {
      setError("Nhập MST nguồn.");
      return;
    }
    setLoadingFetch(true);
    setItems([]);
    setSelectedKeys([]);
    setLogs([]);
    try {
      const login = await loginMinvoice10(sourceNorm);
      const page = await fetchSpecialConfig10({
        taxCode: sourceNorm,
        token: login.token,
      });
      setItems(page.items);
      setSelectedKeys(page.items.map((it, idx) => itemKey(it, idx)));
      toast.success(
        <ToastNotify
          status={0}
          message={`Đã lấy ${page.items.length} cấu hình đặc thù từ ${login.taxCodeComVn}`}
        />,
        { style: styleSuccess },
      );
      if (page.items.length === 0) {
        setError("MST nguồn không có cấu hình đặc thù (CM0012 rỗng).");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi khi lấy cấu hình đặc thù";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setLoadingFetch(false);
    }
  };

  const handleCopy = async () => {
    setError("");
    if (!sourceNorm || !targetNorm) {
      setError("Nhập đủ MST nguồn và MST đích.");
      return;
    }
    if (sourceComVn === targetComVn) {
      setError("MST nguồn và đích không được trùng.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Chọn ít nhất 1 cấu hình để copy.");
      return;
    }

    stopRef.current = false;
    setCopying(true);
    setLogs([]);
    setProgress({ message: "Bắt đầu copy…" });

    try {
      const result = await copySpecialConfigs({
        targetTaxCode: targetNorm,
        items: selectedItems,
        shouldStop: () => stopRef.current,
        onProgress: (p) => setProgress({ ...p }),
      });
      setLogs(result.logs || []);
      toast.success(
        <ToastNotify
          status={0}
          message={`Xong: ${result.ok} OK · ${result.fail} lỗi → ${result.target}`}
        />,
        { style: styleSuccess },
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi khi copy cấu hình";
      setError(msg);
      toast.error(<ToastNotify status={-1} message={msg} />, {
        style: styleError,
      });
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="create-unit-page">
      <ToastContainer position="top-right" autoClose={3500} />

      <div className="create-unit-hero">
        <h1>Copy cấu hình đặc thù 1.0</h1>
        <p>
          Lấy từ MST nguồn (<code>Pattern/GetData?command=CM0012</code>) → chọn
          field → lưu sang MST đích (<code>SaveChangeTTKhac</code>). Domain{" "}
          <code>.minvoice.com.vn</code> (bỏ dấu <code>-</code>).
        </p>
      </div>

      {error ? <div className="create-unit-alert">{error}</div> : null}

      <section className="create-unit-card">
        <div className="create-unit-card-head">
          <h2>1. MST nguồn / đích</h2>
        </div>
        <div className="create-unit-card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
              maxWidth: 720,
            }}
          >
            <div>
              <label className="create-unit-label" htmlFor="csc-source">
                MST nguồn (có cấu hình)
              </label>
              <input
                id="csc-source"
                className="create-unit-input"
                value={sourceTax}
                onChange={(e) => setSourceTax(e.target.value)}
                placeholder="VD: 0105172567"
                disabled={loadingFetch || copying}
                style={{ width: "100%" }}
              />
              {sourceComVn ? (
                <p className="create-unit-hint" style={{ marginTop: 4 }}>
                  <code>{buildComVnBaseUrl(sourceTax)}</code>
                </p>
              ) : null}
            </div>
            <div>
              <label className="create-unit-label" htmlFor="csc-target">
                MST đích (nhận cấu hình)
              </label>
              <input
                id="csc-target"
                className="create-unit-input"
                value={targetTax}
                onChange={(e) => setTargetTax(e.target.value)}
                placeholder="VD: 0105172567-003 hoặc 0105172567003"
                disabled={loadingFetch || copying}
                style={{ width: "100%" }}
              />
              {targetComVn ? (
                <p className="create-unit-hint" style={{ marginTop: 4 }}>
                  <code>{buildComVnBaseUrl(targetTax)}</code>
                </p>
              ) : null}
            </div>
          </div>

          <div className="create-unit-actions">
            <button
              type="button"
              className="create-unit-btn create-unit-btn-primary"
              onClick={handleFetch}
              disabled={loadingFetch || copying || !sourceNorm}
            >
              {loadingFetch ? "Đang lấy…" : "Lấy cấu hình nguồn (CM0012)"}
            </button>
          </div>
        </div>
      </section>

      <section className="create-unit-card" style={{ marginTop: "1rem" }}>
        <div className="create-unit-card-head">
          <h2>2. Chọn cấu hình &amp; copy</h2>
        </div>
        <div className="create-unit-card-body">
          <div className="create-unit-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-ghost"
              onClick={() => setSelectedKeys(options.map((o) => o.value))}
              disabled={!options.length || copying}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-ghost"
              onClick={() => setSelectedKeys([])}
              disabled={!options.length || copying}
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-success"
              onClick={handleCopy}
              disabled={
                copying ||
                !sourceNorm ||
                !targetNorm ||
                selectedItems.length === 0
              }
            >
              {copying
                ? "Đang copy…"
                : `Copy sang đích (${selectedItems.length})`}
            </button>
            <button
              type="button"
              className="create-unit-btn create-unit-btn-secondary"
              onClick={() => {
                stopRef.current = true;
              }}
              disabled={!copying}
            >
              Dừng
            </button>
          </div>

          <label
            className="create-unit-label"
            htmlFor="csc-multi"
            style={{ marginTop: 12 }}
          >
            Trường đặc thù ({selectedItems.length}
            {items.length ? `/${items.length}` : ""})
          </label>
          <MultiSelect
            inputId="csc-multi"
            value={selectedKeys}
            options={options}
            onChange={(e) =>
              setSelectedKeys(Array.isArray(e.value) ? e.value : [])
            }
            optionLabel="label"
            optionValue="value"
            placeholder={
              items.length === 0
                ? "Bấm Lấy cấu hình nguồn…"
                : "Chọn field cần copy…"
            }
            filter
            filterBy="label,value"
            display="chip"
            showClear
            showSelectAll
            selectAllLabel="Chọn tất cả"
            disabled={items.length === 0 || copying}
            className="w-full"
            style={{ width: "100%", maxWidth: 720 }}
            maxSelectedLabels={3}
            selectedItemsLabel="{0} field đã chọn"
          />

          {items.length > 0 ? (
            <div className="create-unit-table-wrap" style={{ marginTop: "1rem" }}>
              <table className="create-unit-table">
                <thead>
                  <tr>
                    <th>ttruong</th>
                    <th>label</th>
                    <th>kdlieu</th>
                    <th>parrent</th>
                    <th>is_use</th>
                    <th>is_lephi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const key = itemKey(it, idx);
                    const selected = selectedKeys.includes(key);
                    return (
                      <tr
                        key={key}
                        className={selected ? "ok" : ""}
                        style={{ opacity: selected ? 1 : 0.55 }}
                      >
                        <td>
                          <code>{it.ttruong}</code>
                        </td>
                        <td>{it.label}</td>
                        <td>{it.kdlieu}</td>
                        <td>{it.parrent}</td>
                        <td>{it.is_use ? "✓" : "—"}</td>
                        <td>{it.is_lephi ? "✓" : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {progress ? (
            <div className="create-unit-status warn" style={{ marginTop: "0.75rem" }}>
              <span className="create-unit-status-dot" />
              <div>{progress.message}</div>
            </div>
          ) : null}

          {logs.length > 0 ? (
            <div className="create-unit-table-wrap" style={{ marginTop: "1rem" }}>
              <table className="create-unit-table">
                <thead>
                  <tr>
                    <th>ttruong</th>
                    <th>label</th>
                    <th>OK</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, idx) => (
                    <tr
                      key={`${l.ttruong}-${idx}`}
                      className={l.ok ? "ok" : "fail"}
                    >
                      <td>
                        <code>{l.ttruong}</code>
                      </td>
                      <td>{l.label}</td>
                      <td>{l.ok ? "✓" : "✗"}</td>
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

export default CopySpecialConfig10;
