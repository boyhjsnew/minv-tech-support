import React, { useRef, useState } from "react";
import { getPatternList } from "../Utils/GetPatternList";
import { extractRepxFromFile } from "../Utils/repx/extractRepx";

const REPX_FEATURES = [
  { value: "extract-images", label: "Đọc ảnh / logo nhúng" },
  {
    value: "add-qhns-cccd",
    label: "Thêm Mã QHNS & Căn cước công dân",
  },
];

const PAGE_SIZE = 50;

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN");
}

function RepxImageExtractor() {
  const fileInputRef = useRef(null);
  const [feature, setFeature] = useState("extract-images");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [taxCode, setTaxCode] = useState("");
  const [patternLoading, setPatternLoading] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [patternTotal, setPatternTotal] = useState(0);
  const [patternStart, setPatternStart] = useState(0);
  const [addingId, setAddingId] = useState(null);
  const [addMessage, setAddMessage] = useState("");

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".repx")) {
      setError("Vui lòng chọn file .repx");
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await extractRepxFromFile(file);
      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không đọc được file REPX.";
      setError(message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const fetchPatterns = async (start = 0) => {
    setPatternLoading(true);
    setError("");
    setAddMessage("");

    try {
      const res = await getPatternList(taxCode, { start, count: PAGE_SIZE });
      setPatterns(res.data);
      setPatternTotal(res.totalCount);
      setPatternStart(start);
    } catch (err) {
      setPatterns([]);
      setPatternTotal(0);
      setError(err?.message || "Không lấy được danh sách mẫu");
    } finally {
      setPatternLoading(false);
    }
  };

  const handleAddPattern = async (item) => {
    setAddingId(item.id);
    setAddMessage("");
    setError("");

    try {
      // Bước tiếp theo: patch REPX thêm MDVQHNSach + CCCDan cho mẫu này
      setAddMessage(
        `Đã chọn mẫu "${item.tmau}" (${item.khhdon}). Bước patch REPX QHNS/CCCD sẽ được xử lý tiếp.`,
      );
    } finally {
      setAddingId(null);
    }
  };

  const embeddedImages =
    result?.images?.filter((img) => img.source === "embedded") || [];
  const otherImages =
    result?.images?.filter((img) => img.source !== "embedded") || [];

  const isQhnsFeature = feature === "add-qhns-cccd";
  const patternPage = Math.floor(patternStart / PAGE_SIZE) + 1;
  const patternTotalPages = Math.max(1, Math.ceil(patternTotal / PAGE_SIZE));

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "8px" }}>Xử lý REPX 1.0</h2>
      <p style={{ color: "#666", marginBottom: "20px", fontSize: "14px" }}>
        {isQhnsFeature
          ? "Nhập MST để lấy danh sách mẫu hóa đơn, sau đó bấm Thêm trên từng mẫu cần bổ sung QHNS & CCCD."
          : "Chọn file .repx để trích xuất logo/ảnh nhúng."}
      </p>

      <div style={{ marginBottom: "16px" }}>
        <label
          htmlFor="repx-feature"
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          Tính năng
        </label>
        <select
          id="repx-feature"
          value={feature}
          onChange={(e) => {
            setFeature(e.target.value);
            setError("");
            setResult(null);
            setAddMessage("");
            setPatterns([]);
            setPatternTotal(0);
          }}
          disabled={loading || patternLoading}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "10px 12px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "white",
          }}
        >
          {REPX_FEATURES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {isQhnsFeature ? (
        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="repx-tax-code"
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Mã số thuế
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              id="repx-tax-code"
              type="text"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              placeholder="vd: hoadon hoặc 0106026495"
              disabled={patternLoading}
              style={{
                flex: "1 1 220px",
                maxWidth: "320px",
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <button
              type="button"
              onClick={() => fetchPatterns(0)}
              disabled={patternLoading || !taxCode.trim()}
              style={{
                padding: "10px 20px",
                backgroundColor:
                  patternLoading || !taxCode.trim() ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontWeight: "bold",
                cursor:
                  patternLoading || !taxCode.trim() ? "not-allowed" : "pointer",
              }}
            >
              {patternLoading ? "Đang tải..." : "Lấy danh sách mẫu"}
            </button>
          </div>
          <div style={{ marginTop: "6px", fontSize: "12px", color: "#888" }}>
            API: https://
            {(taxCode || "mst").trim().replace(/-/g, "") || "mst"}
            .minvoice.com.vn/api/Pattern/GetData (CM0008)
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "2px dashed #ccc",
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
            backgroundColor: "#fafafa",
            marginBottom: "20px",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".repx"
            onChange={handleFileChange}
            disabled={loading}
            style={{ display: "none" }}
            id="repx-file-input"
          />
          <label
            htmlFor="repx-file-input"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: loading ? "#ccc" : "#007bff",
              color: "white",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {loading ? "Đang đọc file..." : "Chọn file .repx"}
          </label>
          {fileName && (
            <div style={{ marginTop: "10px", fontSize: "13px", color: "#333" }}>
              File: {fileName}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {addMessage && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#d4edda",
            color: "#155724",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          {addMessage}
        </div>
      )}

      {isQhnsFeature && patterns.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px" }}>
              Danh sách mẫu ({patterns.length}/{patternTotal})
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={patternLoading || patternStart <= 0}
                onClick={() => fetchPatterns(Math.max(0, patternStart - PAGE_SIZE))}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  background: "white",
                  cursor: patternStart <= 0 ? "not-allowed" : "pointer",
                }}
              >
                ← Trước
              </button>
              <span style={{ fontSize: "13px", lineHeight: "32px" }}>
                Trang {patternPage}/{patternTotalPages}
              </span>
              <button
                type="button"
                disabled={
                  patternLoading || patternStart + PAGE_SIZE >= patternTotal
                }
                onClick={() => fetchPatterns(patternStart + PAGE_SIZE)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  background: "white",
                  cursor:
                    patternStart + PAGE_SIZE >= patternTotal
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Sau →
              </button>
            </div>
          </div>

          <div
            style={{
              overflowX: "auto",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              backgroundColor: "white",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th style={thStyle}>STT</th>
                  <th style={thStyle}>Tên mẫu</th>
                  <th style={thStyle}>Ký hiệu</th>
                  <th style={thStyle}>Loại HĐ</th>
                  <th style={thStyle}>Mẫu số</th>
                  <th style={thStyle}>Ngày tạo</th>
                  <th style={thStyle}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((item, index) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>{patternStart + index + 1}</td>
                    <td style={tdStyle}>{item.tmau || "—"}</td>
                    <td style={tdStyle}>
                      <strong>{item.khhdon || "—"}</strong>
                    </td>
                    <td style={tdStyle}>{item.lhdon ?? "—"}</td>
                    <td style={tdStyle}>{item.mau_so || "—"}</td>
                    <td style={tdStyle}>{formatDate(item.date_new)}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => handleAddPattern(item)}
                        disabled={addingId === item.id}
                        style={{
                          padding: "6px 14px",
                          backgroundColor:
                            addingId === item.id ? "#ccc" : "#007bff",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold",
                          cursor:
                            addingId === item.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {addingId === item.id ? "..." : "Thêm"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!isQhnsFeature && result && (
        <div>
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#e7f3ff",
              borderRadius: "4px",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            <strong>Tổng quan:</strong> {result.summary.totalPictureBoxes}{" "}
            PictureBox — {result.summary.embeddedCount} ảnh nhúng,{" "}
            {result.summary.boundCount} bind/không có ảnh,{" "}
            {result.summary.urlCount} URL — định dạng file:{" "}
            <strong>{result.format.toUpperCase()}</strong>
            {result.format === "codedom" &&
              result.codedomMeta?.devExpressVersion && (
                <> (DevExpress v{result.codedomMeta.devExpressVersion})</>
              )}
          </div>

          {embeddedImages.length > 0 && (
            <section style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
                Ảnh nhúng ({embeddedImages.length})
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                {embeddedImages.map((img) => (
                  <div
                    key={img.name}
                    style={{
                      border: "1px solid #dee2e6",
                      borderRadius: "8px",
                      padding: "12px",
                      backgroundColor: "white",
                    }}
                  >
                    {img.dataUrl && (
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "160px",
                          objectFit: "contain",
                          display: "block",
                          margin: "0 auto 10px",
                          border: "1px solid #eee",
                        }}
                      />
                    )}
                    <div style={{ fontSize: "13px" }}>
                      <div>
                        <strong>{img.name}</strong>
                      </div>
                      <div style={{ color: "#666" }}>{img.mimeType}</div>
                      <div style={{ color: "#666" }}>
                        {img.resourceKey ? `Resource: ${img.resourceKey}` : ""}
                        {img.sizeBytes != null
                          ? `${img.resourceKey ? " · " : ""}${(img.sizeBytes / 1024).toFixed(1)} KB`
                          : ""}
                      </div>
                      {img.dataUrl && (
                        <a
                          href={img.dataUrl}
                          download={`${img.name}.png`}
                          style={{ fontSize: "12px" }}
                        >
                          Tải ảnh
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {otherImages.length > 0 && (
            <section>
              <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
                PictureBox khác ({otherImages.length})
              </h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  backgroundColor: "white",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    <th style={thStyle}>Tên</th>
                    <th style={thStyle}>Loại</th>
                    <th style={thStyle}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {otherImages.map((img) => (
                    <tr key={img.name}>
                      <td style={tdStyle}>{img.name}</td>
                      <td style={tdStyle}>{img.source}</td>
                      <td style={tdStyle}>
                        {img.expression || img.imageUrl || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {embeddedImages.length === 0 && otherImages.length === 0 && (
            <p style={{ color: "#666" }}>
              Không tìm thấy XRPictureBox trong file.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "2px solid #dee2e6",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "8px",
  borderBottom: "1px solid #eee",
  verticalAlign: "middle",
};

export default RepxImageExtractor;
