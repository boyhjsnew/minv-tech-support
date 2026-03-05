import React, { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL = "http://bienlai70.vpdkddtphcm.com.vn/api/InvoiceApi78/Save";
const AUTH_HEADER = "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=";

const COLUMN_KEYS = {
  invoiceSeries: [
    "Ký hiệu *",
    "Ký hiệu",
    "Ky hieu",
    "Ky_hieu",
    "series",
    "khieu",
  ],
  invoiceNumber: [
    "Số đơn hàng *",
    "Số hóa đơn",
    "So hoa don",
    "Số BL",
    "SoBL",
    "sdhang",
  ],
  invoiceDate: [
    "Ngày biên lai*",
    "Ngày biên lai",
    "Ngay bien lai",
    "Ngày hóa đơn",
    "tdlap",
  ],
  buyerName: ["Tên người nộp", "Ten nguoi nop", "tnmua"],
  buyerLegalName: ["Tên đơn vị nộp", "Ten don vi nop", "ten"],
  address: ["Địa chỉ", "Dia chi", "Địa chỉ khách hàng", "dchi"],
  taxCode: ["Mã số thuế", "Ma so thue", "MST", "mst"],
  email: ["Email khách hàng", "Email", "Mail", "email"],
  soHoSo: ["Số HS", "Số hồ sơ", "So ho so", "so_hs"],
  ngayHoSo: ["Ngày HS", "Ngày hồ sơ", "Ngay ho so", "ngay_hs"],
  paymentMethod: ["HT thanh toán", "Hình thức thanh toán", "htttoan"],
  itemCode: ["Mã phí", "Ma phi", "ma"],
  itemName: [
    "Tên loại phí",
    "Ten loai phi",
    "Nội dung thu",
    "Noi dung",
    "ten_ct",
  ],
  totalAmount: ["Số tiền", "So tien", "Thành tiền", "Thanh tien", "thtien"],
  dvithu: [
    "Đơn vị lập phiếu tính tiền(dvthu)",
    "Đơn vị thu",
    "Don vi thu",
    "dvthu",
  ],
  nglap: ["Đơn vị lập BL", "Đơn vị lập BL(nglap)", "nglap"],
};

const SAMPLE_TEMPLATE = [
  {
    "Ký hiệu *": "EBL01-25T",
    "Số đơn hàng *": 69723,
    "Ngày biên lai*": "31/10/2025",
    "Tên người nộp": "CÔNG TY CỔ PHẦN BB&NVETH ÚT MỸ CHARMING",
    "Tên đơn vị nộp": "CÔNG TY CỔ PHẦN BB&NVETH ÚT MỸ CHARMING",
    "Địa chỉ":
      "39-39A-43B-45B Võ Văn Kiệt, Phường Cô Giang, Quận 1, TP Hồ Chí Minh",
    "Mã số thuế": "7596745202500003",
    "Email khách hàng": "buyer@example.com",
    "Số HS": 1503898,
    "Ngày HS": "06/12/2022",
    "HT thanh toán": "TM/CK",
    "Mã phí": "14",
    "Tên loại phí":
      "Lệ phí cấp Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà, tài sản gắn liền với đất",
    "Số tiền": 260000,
    "Đơn vị lập phiếu tính tiền(dvthu)": "Chi nhánh VPĐK Số 1",
    "Đơn vị lập BL(nglap)": "Ban VLXD",
  },
];

const getValueByPriority = (row, candidates) => {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
};

const excelSerialToIso = (serial) => {
  if (typeof serial !== "number") return null;
  const utcDays = Math.floor(serial - 25569);
  const dateInMs = utcDays * 86400 * 1000;
  const date = new Date(dateInMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return excelSerialToIso(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parts = trimmed.split(/[/.-]/).map((p) => p.trim());
    if (parts.length === 3) {
      let day;
      let month;
      let year;
      if (parts[0].length === 4) {
        [year, month, day] = parts;
      } else {
        [day, month, year] = parts;
      }
      if (day && month && year) {
        const yyyy = year.length === 2 ? `20${year}` : year.padStart(4, "0");
        const mm = month.padStart(2, "0");
        const dd = day.padStart(2, "0");
        if (
          Number(mm) >= 1 &&
          Number(mm) <= 12 &&
          Number(dd) >= 1 &&
          Number(dd) <= 31
        ) {
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }
  }
  return null;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const mapRecordToPayload = (record, index) => {
  const issuedDate =
    normalizeDateValue(record.invoiceDate) ||
    new Date().toISOString().slice(0, 10);
  const hoSoDate = normalizeDateValue(record.ngayHoSo);
  const totalAmount = normalizeNumber(record.totalAmount);
  const paymentMethod = record.paymentMethod || "TM/CK";
  const nlapValue = record.nglap ? String(record.nglap) : null;

  return {
    ma_ch: null,
    ccdan: null,
    ten_ch: null,
    so_hchieu: null,
    mdvqhnsach_nmua: null,
    inv_invoiceIssuedDate: issuedDate,
    inv_invoiceSeries: record.invoiceSeries || "EBL01-25T",
    inv_invoiceNumber: Number(record.invoiceNumber) || 0,
    so_benh_an: Number(record.invoiceNumber),
    inv_paymentMethodName: paymentMethod,
    inv_currencyCode: "VND",
    inv_exchangeRate: "1.00",
    inv_buyerDisplayName: record.buyerName || record.buyerLegalName || "",
    inv_buyerLegalName: record.buyerLegalName || record.buyerName || "",
    inv_buyerTaxCode: "",
    inv_buyerAddressLine: record.address || ".",
    inv_buyerEmail: record.email || null,
    inv_buyerBankAccount: null,
    inv_buyerBankName: null,
    dcghang: null,
    inv_TotalAmount: totalAmount,
    inv_discountAmount: 0,
    inv_vatAmount: 0,
    inv_TotalAmountWithoutVat: totalAmount,
    TuyenGiaoHang: null,
    Note_Green: null,
    nglap: nlapValue,
    stkdn: null,
    tkdn: null,
    so_hs: record.soHoSo || null,
    ngay_hs: hoSoDate,
    dvithu: record.dvithu || null,
    details: [
      {
        data: [
          {
            tchat: "4",
            stt_rec0: String(index + 1),
            inv_itemCode: record.itemCode,
            inv_itemName: record.itemName,
            inv_unitCode: null,
            inv_quantity: 1,
            inv_unitPrice: totalAmount,
            inv_discountPercentage: null,
            inv_discountAmount: 0,
            inv_TotalAmountWithoutVat: totalAmount,
            ma_thue: -1,
            inv_vatAmount: 0,
            inv_TotalAmount: totalAmount,
          },
        ],
      },
    ],
  };
};

export default function UpdateMuiltipe() {
  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logMessages, setLogMessages] = useState([]);
  // Xuất Excel từ JSON (totalCount, items[]) -> 2 cột: Số hóa đơn (invoiceNumber), ID (id)
  const [jsonInvoiceInput, setJsonInvoiceInput] = useState("");
  const [jsonExportError, setJsonExportError] = useState("");
  // Import Excel 2 cột → gen SQL UPDATE hoadon68 (hoadon68_id_dieuchinh, hoadon68_id_bidieuchinh)
  const [generatedHoadon68Sql, setGeneratedHoadon68Sql] = useState("");
  const [hoadon68SqlError, setHoadon68SqlError] = useState("");
  const [parsingHoadon68Sql, setParsingHoadon68Sql] = useState(false);

  const resetState = () => {
    setRecords([]);
    setLogMessages([]);
    setFileName("");
  };

  const parseExcelFile = (file) => {
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

        if (!jsonData || jsonData.length === 0) {
          setLogMessages((prev) => [
            ...prev,
            { type: "error", message: "File Excel không có dữ liệu." },
          ]);
          setParsing(false);
          return;
        }

        const mappedRecords = jsonData.map((row) => {
          const record = {};
          Object.entries(COLUMN_KEYS).forEach(([field, keys]) => {
            record[field] = getValueByPriority(row, keys);
          });
          return record;
        });

        setRecords(mappedRecords);
        setLogMessages((prev) => [
          ...prev,
          {
            type: "success",
            message: `Đã đọc ${mappedRecords.length} dòng dữ liệu.`,
          },
        ]);
      } catch (error) {
        console.error("Error reading Excel:", error);
        setLogMessages((prev) => [
          ...prev,
          {
            type: "error",
            message:
              "Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng.",
          },
        ]);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      setLogMessages((prev) => [
        ...prev,
        { type: "error", message: "Không thể mở file. Hãy thử lại." },
      ]);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      resetState();
      return;
    }
    setFileName(file.name);
    setLogMessages([]);
    parseExcelFile(file);
  };

  const handleSubmit = async () => {
    if (records.length === 0) {
      setLogMessages((prev) => [
        ...prev,
        { type: "error", message: "Chưa có dữ liệu để gửi." },
      ]);
      return;
    }

    setSubmitting(true);
    setLogMessages([]);

    const errorLogs = [];

    // Gửi từng hóa đơn một (1:1)
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const payload = {
        editmode: 2,
        data: [mapRecordToPayload(record, 0)],
      };

      try {
        const response = await axios.post(API_URL, payload, {
          headers: {
            Authorization: AUTH_HEADER,
            "Content-Type": "application/json",
          },
        });

        const apiResult = response.data || {};
        const code = apiResult.code ?? "N/A";
        const message =
          apiResult.message !== undefined && apiResult.message !== null
            ? String(apiResult.message)
            : null;

        // Chỉ log nếu code khác "00" hoặc có message lỗi
        if (
          code !== "00" ||
          (message && message.trim() !== "" && message !== "null")
        ) {
          const invoiceNumber = record.invoiceNumber || i + 1;
          errorLogs.push({
            type: "error",
            message: `HĐ ${invoiceNumber}: code ${code}, message ${
              message || "null"
            }`,
          });
        }
      } catch (error) {
        console.error(`API error for record ${i + 1}:`, error);
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data ||
          error.message ||
          "Có lỗi xảy ra khi gọi API.";
        const errorCode = error.response?.data?.code ?? "N/A";
        const invoiceNumber = record.invoiceNumber || i + 1;
        errorLogs.push({
          type: "error",
          message: `HĐ ${invoiceNumber}: code ${errorCode}, message ${errorMessage}`,
        });
      }
    }

    // Chỉ set log nếu có lỗi
    if (errorLogs.length > 0) {
      setLogMessages(errorLogs);
    } else {
      // Không có lỗi, không hiển thị gì
      setLogMessages([]);
    }

    setSubmitting(false);
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Mau-Cap-Nhat-Hoa-Don.xlsx");
  };

  // Xuất Excel từ JSON: { totalCount, items: [{ invoiceNumber, id, ... }] } -> 2 cột: Số hóa đơn, ID
  const handleExportJsonToExcel = () => {
    setJsonExportError("");
    const raw = jsonInvoiceInput.trim();
    if (!raw) {
      setJsonExportError("Vui lòng dán nội dung JSON vào ô bên trên.");
      return;
    }
    try {
      const data = JSON.parse(raw);
      const items = data?.items;
      if (!Array.isArray(items) || items.length === 0) {
        setJsonExportError("JSON phải có mảng 'items' và không rỗng.");
        return;
      }
      const rows = items.map((item) => ({
        "Số hóa đơn": item.invoiceNumber ?? "",
        ID: item.id ?? "",
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "HoaDon");
      const fileName = `So_hoa_don_va_ID_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (e) {
      setJsonExportError(
        e instanceof SyntaxError
          ? "JSON không hợp lệ. Kiểm tra dấu phẩy, ngoặc."
          : e?.message || "Có lỗi khi xử lý JSON."
      );
    }
  };

  // Escape single quote trong giá trị SQL
  const escapeSqlValue = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/'/g, "''");
  };

  // Import Excel 2 cột (hoadon68_id_dieuchinh, hoadon68_id_bidieuchinh) → gen SQL UPDATE hoadon68
  const handleHoadon68ExcelChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setHoadon68SqlError("");
    setGeneratedHoadon68Sql("");
    if (!file) return;
    setParsingHoadon68Sql(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: "" });
        if (!rows || rows.length === 0) {
          setHoadon68SqlError("File Excel không có dữ liệu.");
          setParsingHoadon68Sql(false);
          return;
        }
        const keys = Object.keys(rows[0] || {});
        const keyDieuchinh =
          keys.find((k) => /dieuchinh/i.test(k) && !/bidieuchinh/i.test(k)) ||
          keys[0];
        const keyBidieuchinh =
          keys.find((k) => /bidieuchinh/i.test(k)) || keys[1];
        if (!keyDieuchinh || !keyBidieuchinh) {
          setHoadon68SqlError(
            "Cần ít nhất 2 cột: hoadon68_id_dieuchinh, hoadon68_id_bidieuchinh."
          );
          setParsingHoadon68Sql(false);
          return;
        }
        const statements = [];
        rows.forEach((row) => {
          const idDieuchinh = escapeSqlValue(row[keyDieuchinh]);
          const idBidieuchinh = escapeSqlValue(row[keyBidieuchinh]);
          if (!idDieuchinh || !idBidieuchinh) {
            return;
          }
          // Hóa đơn điều chỉnh
          statements.push(
            `UPDATE hoadon68 SET tthdon=2,is_tthdon=2,is_mau04=0,hdlket_id='${idBidieuchinh}' WHERE hoadon68_id='${idDieuchinh}';`
          );
          // Hóa đơn bị điều chỉnh
          statements.push(
            `UPDATE hoadon68 SET tthdon=7,is_tthdon=7,is_mau04=0,hdlket_id='${idDieuchinh}' WHERE hoadon68_id='${idBidieuchinh}';`
          );
        });
        setGeneratedHoadon68Sql(statements.join("\n"));
      } catch (err) {
        setHoadon68SqlError(err?.message || "Không thể đọc file Excel.");
      } finally {
        setParsingHoadon68Sql(false);
      }
    };
    reader.onerror = () => {
      setHoadon68SqlError("Không thể mở file.");
      setParsingHoadon68Sql(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCopyHoadon68Sql = () => {
    if (!generatedHoadon68Sql) return;
    navigator.clipboard.writeText(generatedHoadon68Sql);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>
          Cập nhật hóa đơn bằng Excel 1.0
        </h2>
        {/* <p style={{ maxWidth: 720, color: "#555" }}>
          Chọn file Excel theo mẫu chứa thông tin hóa đơn (ký hiệu, số hóa đơn,
          ngày lập, đơn vị nộp, địa chỉ, MST, email, số hồ sơ, ngày hồ sơ, nội
          dung phí, số tiền...). Hệ thống sẽ đọc dữ liệu, hiển thị bản xem trước
          và gửi toàn bộ sang API `InvoiceApi78/Save`.
        </p> */}
      </div>

      {/* Xuất Excel từ JSON: 2 cột Số hóa đơn (invoiceNumber), ID (id) */}
      <div
        style={{
          padding: "1rem",
          background: "#f8fafc",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "1.5rem",
        }}
      >
        <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>
          Xuất Excel từ JSON (Số hóa đơn + ID)
        </h3>
        <p style={{ marginBottom: "0.5rem", fontSize: 13, color: "#64748b" }}>
          Dán JSON có cấu trúc <code>{`{ totalCount, items: [{ invoiceNumber, id, ... }] }`}</code> để xuất file Excel 2 cột: <strong>Số hóa đơn</strong>, <strong>ID</strong>.
        </p>
        <textarea
          value={jsonInvoiceInput}
          onChange={(e) => {
            setJsonInvoiceInput(e.target.value);
            setJsonExportError("");
          }}
          placeholder='{"totalCount": 90, "items": [{ "invoiceNumber": 20, "id": "3a1f9c37-..." }, ...]}'
          style={{
            width: "100%",
            minHeight: 120,
            padding: "0.5rem",
            fontSize: 12,
            fontFamily: "monospace",
            border: "1px solid #e2e8f0",
            borderRadius: 4,
            resize: "vertical",
          }}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleExportJsonToExcel}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: 4,
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Xuất Excel (Số hóa đơn + ID)
          </button>
          {jsonExportError && (
            <span style={{ color: "#dc2626", fontSize: 13 }}>{jsonExportError}</span>
          )}
        </div>
      </div>

      {/* Import Excel 2 cột → Gen SQL UPDATE hoadon68 */}
      <div
        style={{
          padding: "1rem",
          background: "#f0fdf4",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "1.5rem",
        }}
      >
        <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>
          Import Excel → Gen SQL UPDATE hoadon68
        </h3>
        <p style={{ marginBottom: "0.5rem", fontSize: 13, color: "#64748b" }}>
          File Excel 2 cột: <strong>hoadon68_id_dieuchinh</strong> (WHERE), <strong>hoadon68_id_bidieuchinh</strong> (SET hdlket_id). Sau khi import sẽ sinh câu lệnh SQL để copy.
        </p>
        <div style={{ marginBottom: "0.5rem" }}>
          <label
            htmlFor="hoadon68-sql-upload"
            style={{
              display: "inline-block",
              padding: "0.45rem 1rem",
              borderRadius: 4,
              border: "1px solid #22c55e",
              background: "#22c55e",
              color: "#fff",
              cursor: parsingHoadon68Sql ? "not-allowed" : "pointer",
            }}
          >
            {parsingHoadon68Sql ? "Đang đọc..." : "Chọn file Excel (2 cột)"}
          </label>
          <input
            id="hoadon68-sql-upload"
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleHoadon68ExcelChange}
            disabled={parsingHoadon68Sql}
          />
          {generatedHoadon68Sql && (
            <button
              type="button"
              onClick={handleCopyHoadon68Sql}
              style={{
                marginLeft: "0.5rem",
                padding: "0.45rem 1rem",
                borderRadius: 4,
                border: "1px solid #16a34a",
                background: "#fff",
                color: "#16a34a",
                cursor: "pointer",
              }}
            >
              Copy SQL
            </button>
          )}
        </div>
        {hoadon68SqlError && (
          <div style={{ color: "#dc2626", fontSize: 13, marginBottom: "0.5rem" }}>
            {hoadon68SqlError}
          </div>
        )}
        {generatedHoadon68Sql && (
          <textarea
            readOnly
            value={generatedHoadon68Sql}
            style={{
              width: "100%",
              minHeight: 180,
              padding: "0.5rem",
              fontSize: 12,
              fontFamily: "monospace",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              resize: "vertical",
            }}
          />
        )}
      </div>

      <div
        style={{
          padding: "1rem",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "1.5rem",
        }}
      >
        <label
          htmlFor="invoice-upload"
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            background: "#0069b4",
            color: "#fff",
            borderRadius: 4,
            cursor: parsing ? "not-allowed" : "pointer",
          }}
        >
          {parsing ? "Đang đọc file..." : "Chọn file Excel"}
        </label>
        <input
          id="invoice-upload"
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={parsing || submitting}
        />
        {fileName && (
          <span style={{ marginLeft: "1rem" }}>File: {fileName}</span>
        )}
        <button
          type="button"
          onClick={handleDownloadTemplate}
          style={{
            marginLeft: "1.5rem",
            padding: "0.45rem 1.2rem",
            borderRadius: 4,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            cursor: "pointer",
          }}
        >
          Tải file mẫu
        </button>
      </div>

      {records.length > 0 && (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: 6,
                border: "none",
                background: submitting ? "#94a3b8" : "#10b981",
                color: "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {submitting ? "Đang gửi..." : "Gửi dữ liệu lên API"}
            </button>
          </div>

          <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th>#</th>
                  <th>Ký hiệu</th>
                  <th>Số đơn hàng</th>
                  <th>Ngày biên lai</th>
                  <th>Tên người nộp</th>
                  <th>Tên đơn vị nộp</th>
                  <th>Địa chỉ</th>
                  <th>Mã số thuế</th>
                  <th>Email khách hàng</th>
                  <th>Số HS</th>
                  <th>Ngày HS</th>
                  <th>HT thanh toán</th>
                  <th>Mã phí</th>
                  <th>Tên loại phí</th>
                  <th>Số tiền</th>
                  <th>Đơn vị lập phiếu tính tiền</th>
                  <th>Đơn vị lập BL</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={`${record.invoiceNumber}-${index}`}>
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "0.4rem",
                      }}
                    >
                      {index + 1}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.invoiceSeries || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.invoiceNumber || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {normalizeDateValue(record.invoiceDate) || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.buyerName || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.buyerLegalName || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.address || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.taxCode || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.email || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.soHoSo || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {normalizeDateValue(record.ngayHoSo) || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.paymentMethod || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.itemCode || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.itemName || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {normalizeNumber(record.totalAmount).toLocaleString(
                        "vi-VN"
                      )}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.dvithu || "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {record.nglap || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {logMessages.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h4 style={{ marginBottom: "0.5rem" }}>Nhật ký xử lý</h4>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {logMessages.map((log, idx) => (
              <li
                key={`${log.type}-${idx}`}
                style={{
                  color:
                    log.type === "error"
                      ? "#dc2626"
                      : log.type === "success"
                      ? "#16a34a"
                      : "#0f172a",
                  marginBottom: 4,
                }}
              >
                {log.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
