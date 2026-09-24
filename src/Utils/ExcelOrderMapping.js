import * as XLSX from "xlsx";

/**
 * Alias tìm cột "Mã đơn hàng" — ưu tiên khớp chính xác, không phụ thuộc vị trí cột.
 * Tránh alias quá ngắn (vd "mã đơn") để không bắt nhầm "Mã đơn vị".
 */
const ORDER_CODE_ALIASES = [
  "mã đơn hàng",
  "ma don hang",
  "madonhang",
  "mã đơn hàng (*)",
  "ma don hang (*)",
  "order code",
  "order id",
  "orderid",
  "order no",
  "orderno",
  "mã dh",
  "ma dh",
];

const ORDER_DATE_ALIASES = [
  "ngày đặt hàng",
  "ngay dat hang",
  "ngaydathang",
  "ngày đặt hàng (*)",
  "ngay dat hang (*)",
  "ngày đặt",
  "ngay dat",
  "order date",
  "orderdate",
  "ngày dh",
  "ngay dh",
];

/** Chuẩn hoá tên cột để so khớp (bỏ dấu, khoảng trắng, chữ thường). */
export function normalizeHeaderKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Điểm khớp header ↔ alias (càng cao càng đúng).
 * 100: khớp exact sau normalize
 * 90: khớp exact bỏ khoảng trắng
 * 70: header bắt đầu bằng alias đầy đủ
 * 50: header chứa alias (chỉ với alias đủ dài ≥ 8 ký tự compact)
 */
function scoreHeaderAlias(header, alias) {
  const n = normalizeHeaderKey(header);
  const a = normalizeHeaderKey(alias);
  if (!n || !a) return 0;

  const nc = n.replace(/\s+/g, "");
  const ac = a.replace(/\s+/g, "");

  if (n === a || nc === ac) return 100;
  if (n.startsWith(a) || nc.startsWith(ac)) return 70;
  // Chỉ contains khi alias đủ cụ thể — tránh "ma don" bắt "ma don vi"
  if (ac.length >= 8 && (n.includes(a) || nc.includes(ac))) return 50;
  return 0;
}

/**
 * Tìm cột theo alias — duyệt mọi header, chọn điểm cao nhất.
 * Không phụ thuộc thứ tự cột trong Excel.
 */
export function findColumnKey(headers, aliases) {
  let best = null;
  let bestScore = 0;

  for (const h of headers) {
    if (h === null || h === undefined || String(h).trim() === "") continue;
    for (const alias of aliases) {
      const score = scoreHeaderAlias(h, alias);
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
  }

  // Chỉ nhận khi khớp đủ rõ (≥ 50)
  return bestScore >= 50 ? best : null;
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

/** Format ngày ra YYYY-MM-DD hoặc giữ chuỗi gốc nếu không parse được. */
export function formatOrderDate(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatYmd(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 80000) {
      try {
        return formatYmd(excelSerialToDate(value));
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatYmd(parsed);
  }

  return raw;
}

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeOrderCode(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Tìm dòng header trong sheet (tối đa 15 dòng đầu) — cột có thể không ở hàng 1.
 * Trả về { headerRowIndex, headers } hoặc null.
 */
export function findHeaderRow(aoa) {
  const maxScan = Math.min(15, aoa.length);
  let best = null;
  let bestScore = -1;

  for (let r = 0; r < maxScan; r += 1) {
    const row = aoa[r] || [];
    const headers = row.map((c) =>
      c === null || c === undefined ? "" : String(c).trim(),
    );
    if (!headers.some(Boolean)) continue;

    const codeKey = findColumnKey(headers, ORDER_CODE_ALIASES);
    if (!codeKey) continue;

    // Ưu tiên dòng có cả ngày đặt hàng
    const dateKey = findColumnKey(headers, ORDER_DATE_ALIASES);
    const score = (dateKey ? 2 : 1) * 100 - r; // dòng càng gần đầu càng tốt
    if (score > bestScore) {
      bestScore = score;
      best = { headerRowIndex: r, headers, codeKey, dateKey };
    }
  }

  return best;
}

/**
 * Đọc 1 workbook → danh sách { orderCode, orderDate, sourceFile, sheet, mappedColumns }.
 */
export function extractOrdersFromWorkbook(workbook, sourceFile = "") {
  const rowsOut = [];
  const warnings = [];
  const mappedInfo = [];

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });

    if (!aoa.length) continue;

    const headerInfo = findHeaderRow(aoa);
    if (!headerInfo) {
      warnings.push(
        `${sourceFile || "file"} / sheet "${sheetName}": không tìm thấy cột "Mã đơn hàng" (đã quét ${Math.min(15, aoa.length)} dòng đầu, mọi cột)`,
      );
      continue;
    }

    const { headerRowIndex, codeKey, dateKey } = headerInfo;
    const headerRow = aoa[headerRowIndex] || [];

    // Map index cột theo đúng tên header tìm được (không phụ thuộc thứ tự cố định)
    const codeColIdx = headerRow.findIndex(
      (c) => String(c ?? "").trim() === codeKey,
    );
    const dateColIdx = dateKey
      ? headerRow.findIndex((c) => String(c ?? "").trim() === dateKey)
      : -1;

    if (codeColIdx < 0) {
      warnings.push(
        `${sourceFile || "file"} / sheet "${sheetName}": tìm thấy tên cột nhưng không xác định được vị trí`,
      );
      continue;
    }

    mappedInfo.push({
      sourceFile,
      sheet: sheetName,
      headerRow: headerRowIndex + 1,
      orderCodeColumn: codeKey,
      orderCodeColIndex: codeColIdx + 1,
      orderDateColumn: dateKey || "",
      orderDateColIndex: dateColIdx >= 0 ? dateColIdx + 1 : null,
    });

    if (!dateKey) {
      warnings.push(
        `${sourceFile || "file"} / sheet "${sheetName}": có "${codeKey}" (cột ${codeColIdx + 1}) nhưng không thấy "Ngày đặt hàng" — vẫn lấy mã đơn`,
      );
    }

    for (let r = headerRowIndex + 1; r < aoa.length; r += 1) {
      const row = aoa[r] || [];
      const orderCode = normalizeOrderCode(row[codeColIdx]);
      if (!orderCode) continue;
      rowsOut.push({
        orderCode,
        orderDate:
          dateColIdx >= 0 ? formatOrderDate(row[dateColIdx]) : "",
        sourceFile: sourceFile || "",
        sheet: sheetName,
        mappedOrderCodeColumn: codeKey,
        mappedOrderDateColumn: dateKey || "",
      });
    }
  }

  return { rows: rowsOut, warnings, mappedInfo };
}

export function extractOrdersFromArrayBuffer(buffer, sourceFile = "") {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return extractOrdersFromWorkbook(workbook, sourceFile);
}

/**
 * Đọc nhiều File (browser File) → gộp kết quả.
 */
export async function extractOrdersFromFiles(files) {
  const allRows = [];
  const warnings = [];
  const fileStats = [];
  const mappedInfo = [];
  const missingOrderCodeFiles = [];

  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer();
      const {
        rows,
        warnings: w,
        mappedInfo: info,
      } = extractOrdersFromArrayBuffer(buffer, file.name);
      allRows.push(...rows);
      warnings.push(...w);
      mappedInfo.push(...(info || []));

      const noOrderCodeColumn = !(info || []).length;
      const missingMsg = noOrderCodeColumn
        ? 'Không có cột "Mã đơn hàng"'
        : "";

      if (noOrderCodeColumn) {
        missingOrderCodeFiles.push(file.name);
        warnings.unshift(
          `⚠ ${file.name}: Không tìm thấy cột "Mã đơn hàng" — file này bị bỏ qua.`,
        );
      }

      fileStats.push({
        name: file.name,
        count: rows.length,
        ok: !noOrderCodeColumn,
        missingOrderCode: noOrderCodeColumn,
        error: missingMsg,
        mappedColumns: (info || [])
          .map(
            (m) =>
              `"${m.orderCodeColumn}" (cột ${m.orderCodeColIndex}${
                m.orderDateColumn
                  ? `, ngày: "${m.orderDateColumn}" cột ${m.orderDateColIndex}`
                  : ""
              })`,
          )
          .join("; "),
      });
    } catch (err) {
      const msg = err?.message || "Không đọc được file";
      warnings.push(`${file.name}: ${msg}`);
      missingOrderCodeFiles.push(file.name);
      fileStats.push({
        name: file.name,
        count: 0,
        ok: false,
        missingOrderCode: false,
        error: msg,
        mappedColumns: "",
      });
    }
  }

  return {
    rows: allRows,
    warnings,
    fileStats,
    mappedInfo,
    missingOrderCodeFiles,
  };
}

export function mapOrderRowToExport(row) {
  return {
    "Mã đơn hàng": row?.orderCode || "",
    "Ngày đặt hàng": row?.orderDate || "",
    "File nguồn": row?.sourceFile || "",
    Sheet: row?.sheet || "",
  };
}

/** Loại trùng theo mã đơn (giữ bản đầu tiên). */
export function dedupeOrdersByCode(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = normalizeOrderCode(row.orderCode);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
