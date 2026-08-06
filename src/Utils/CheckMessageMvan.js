import axios from "axios";

const DEFAULT_BASE_URL = "http://bienlai70.vpdkddtphcm.com.vn";
const DEFAULT_AUTH =
  "Bear QitQb0pPZE5WbzhLMFBtZ1JzbHhlWnlEejQxZ1hoTENUcFJKZEM2Q1I5Zz06QURNSU5JU1RSQVRPUjo2MzkxOTg5MjU4NTI5NTM5ODI=;VP;vi";

const TD_COLUMN_KEYS = [
  "Mã thông điệp",
  "Ma thong diep",
  "Mã TD",
  "Ma TD",
  "td",
  "TD",
  "Thong diep",
  "Thông điệp",
];

const NGAY_COLUMN_KEYS = [
  "Ngày hóa đơn",
  "Ngay hoa don",
  "Ngày HĐ",
  "Ngay HD",
  "ngay",
  "Ngày",
  "Ngay",
  "invoiceDate",
];

function getValueByPriority(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  const normalizedCandidates = candidates.map((k) =>
    String(k).toLowerCase().replace(/\s+/g, ""),
  );
  for (const [key, val] of Object.entries(row)) {
    const nk = String(key).toLowerCase().replace(/\s+/g, "");
    if (
      normalizedCandidates.includes(nk) &&
      val !== undefined &&
      val !== null &&
      val !== ""
    ) {
      return val;
    }
  }
  return null;
}

/** Chuẩn hóa ngày về YYYY-MM-DD theo param curl (?ngay=2026-03-10).
 * Hỗ trợ: 17/7/2026, 17/07/2026, 2026-07-17, Date, serial Excel.
 */
export function normalizeInvoiceDate(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatYmd(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date (days since 1899-12-30)
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + Math.round(value) * 86400000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return formatYmd(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
      );
    }
  }

  let raw = String(value).trim();
  if (!raw) return "";

  // Bỏ phần giờ nếu có: "17/7/2026 0:00:00" / "2026-07-17T00:00:00"
  raw = raw.split(/\s+/)[0].split("T")[0];

  // YYYY-MM-DD hoặc YYYY/MM/DD
  const iso = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (iso) {
    return formatYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // DD/MM/YYYY hoặc D/M/YYYY (Excel VN thường ghi 17/7/2026)
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    // Ưu tiên kiểu ngày/tháng/năm (VN). Nếu day > 12 thì chắc chắn là DMY.
    // Nếu month > 12 thì có thể là MM/DD/YYYY → đổi.
    if (month > 12 && day <= 12) {
      return formatYmd(year, day, month);
    }
    return formatYmd(year, month, day);
  }

  // DD/MM/YY
  const dmy2 = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (dmy2) {
    const day = Number(dmy2[1]);
    const month = Number(dmy2[2]);
    let year = Number(dmy2[3]);
    year += year >= 70 ? 1900 : 2000;
    if (month > 12 && day <= 12) {
      return formatYmd(year, day, month);
    }
    return formatYmd(year, month, day);
  }

  return "";
}

function formatYmd(year, month, day) {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeMessageCode(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Đọc danh sách { td, ngay } từ Excel (2 cột: mã thông điệp + ngày hóa đơn).
 */
export function parseMessageRowsFromExcel(jsonData) {
  const rows = [];
  const keys = jsonData?.[0] ? Object.keys(jsonData[0]) : [];

  for (const row of jsonData) {
    let tdRaw = getValueByPriority(row, TD_COLUMN_KEYS);
    let ngayRaw = getValueByPriority(row, NGAY_COLUMN_KEYS);

    if (tdRaw == null && keys[0]) tdRaw = row[keys[0]];
    if (ngayRaw == null && keys[1]) ngayRaw = row[keys[1]];

    const td = normalizeMessageCode(tdRaw);
    const ngay = normalizeInvoiceDate(ngayRaw);
    if (!td || !ngay) continue;

    rows.push({ td, ngay });
  }

  return rows;
}

export function buildCheckMessageHeaders(authorization = DEFAULT_AUTH) {
  const auth = (authorization || "").trim() || DEFAULT_AUTH;
  return {
    Authorization: auth.startsWith("Bear") ? auth : `Bear ${auth}`,
    Referer: `${DEFAULT_BASE_URL}/`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
  };
}

/**
 * Tra cứu 1 thông điệp MVAN.
 * GET /api/Pattern/CheckMessageMVAN?td=...&ngay=YYYY-MM-DD
 */
export async function checkMessageMvan(
  { td, ngay },
  { baseUrl = DEFAULT_BASE_URL, authorization = DEFAULT_AUTH } = {},
) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/Pattern/CheckMessageMVAN`;
  try {
    const response = await axios.get(url, {
      params: { td, ngay },
      headers: buildCheckMessageHeaders(authorization),
      timeout: 60000,
    });
    return {
      td,
      ngay,
      ok: true,
      data: response.data,
      error: "",
    };
  } catch (err) {
    return {
      td,
      ngay,
      ok: false,
      data: err?.response?.data ?? null,
      error:
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        err?.message ||
        "Lỗi không xác định",
    };
  }
}

/**
 * Tra cứu hàng loạt theo danh sách Excel.
 */
export async function checkMessageMvanBatch(
  items,
  {
    concurrency = 5,
    delayMs = 100,
    baseUrl = DEFAULT_BASE_URL,
    authorization = DEFAULT_AUTH,
    onProgress,
  } = {},
) {
  const results = new Array(items.length);
  let index = 0;
  let done = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        const item = items[current];
        onProgress?.({
          current: done,
          total: items.length,
          td: item.td,
          ngay: item.ngay,
        });

        results[current] = await checkMessageMvan(item, {
          baseUrl,
          authorization,
        });
        done += 1;
        onProgress?.({
          current: done,
          total: items.length,
          td: item.td,
          ngay: item.ngay,
        });

        if (delayMs > 0 && index < items.length) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    },
  );

  await Promise.all(workers);
  return results;
}

export function mapCheckMessageRowToExport(row) {
  const data = row?.data;
  const payload =
    data && typeof data === "object"
      ? typeof data.data === "object"
        ? data.data
        : data
      : null;

  return {
    "Mã thông điệp": row?.td || "",
    "Ngày hóa đơn": row?.ngay || "",
    "Trạng thái gọi API": row?.ok ? "Thành công" : "Thất bại",
    "Mã phản hồi":
      data?.code ?? data?.Code ?? payload?.code ?? payload?.Code ?? "",
    "Thông báo":
      row?.error ||
      data?.message ||
      data?.Message ||
      payload?.message ||
      payload?.Message ||
      "",
    "Kết quả (JSON)":
      data != null
        ? typeof data === "string"
          ? data
          : JSON.stringify(data)
        : "",
  };
}

export { DEFAULT_BASE_URL, DEFAULT_AUTH };
