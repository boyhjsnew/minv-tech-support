import axios from "axios";

const DEFAULT_AUTH =
  "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=";

/** Ký hiệu năm 2026 dạng 1C26__ / 2C26__ (chứa C26) */
const SERIES_C26 = "C26";

const MST_COLUMN_KEYS = [
  "Mã số thuế",
  "Ma so thue",
  "MST",
  "mst",
  "Mã MST",
  "taxCode",
];

export function normalizeMst(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Za-z-]/g, "");
}

/** Chỉ lấy chữ số — để nhận diện MST 13 ký tự (có/không dấu -). */
export function mstDigits(value) {
  return normalizeMst(value).replace(/[^0-9]/g, "");
}

/**
 * MST trên subdomain theo domain:
 * - MST 13 số (vd 0313466783004 hoặc 0313466783-004):
 *   .minvoice.app / .minvoice.site → 0313466783-004
 *   .minvoice.com.vn → 0313466783004 (bỏ dấu -)
 */
export function formatMstForDomain(taxCode, domain) {
  const raw = normalizeMst(taxCode);
  const digits = mstDigits(raw);
  const d = String(domain || "").toLowerCase();
  const isAppLike = d.includes(".minvoice.app") || d.includes(".minvoice.site");
  const isComVn = d.includes(".minvoice.com.vn");

  if (digits.length === 13) {
    if (isAppLike) return `${digits.slice(0, 10)}-${digits.slice(10)}`;
    if (isComVn) return digits;
  }

  if (isComVn) return digits || raw.replace(/-/g, "");
  return raw;
}

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

export function parseMstListFromExcelRows(jsonData) {
  const seen = new Set();
  const list = [];
  for (const row of jsonData) {
    let raw = getValueByPriority(row, MST_COLUMN_KEYS);
    if (raw == null && Object.keys(row).length > 0) {
      raw = row[Object.keys(row)[0]];
    }
    const mst = normalizeMst(raw);
    if (!mst) continue;
    const key = mstDigits(mst) || mst;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(mst);
  }
  return list;
}

/** Domains cần thử theo 2 phiên bản HĐ */
export function getCandidateDomains(taxCode) {
  const tax = normalizeMst(taxCode);
  if (!tax) return [];
  const digits = mstDigits(tax);
  if (tax.endsWith("-998") || digits.endsWith("998")) {
    return [".minvoice.site", ".minvoice.com.vn"];
  }
  return [".minvoice.app", ".minvoice.com.vn"];
}

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Khoảng N tháng gần nhất (tính đến hôm nay). */
export function getLastMonthsRange(months = 3, now = new Date()) {
  const n = months === 6 ? 6 : 3;
  const denngay = formatYmd(now);
  const from = new Date(now);
  from.setMonth(from.getMonth() - n);
  const tuNgay = formatYmd(from);
  return { tuNgay, denngay, months: n };
}

/** @deprecated dùng getLastMonthsRange */
export function getLast3MonthsRange(now = new Date()) {
  return getLastMonthsRange(3, now);
}

function buildAuthHeader(userToken) {
  const t = (userToken || "").trim();
  if (!t) return DEFAULT_AUTH;
  if (/^Bear\s+/i.test(t) || /^Bearer\s+/i.test(t)) return t;
  return `Bear ${t}`;
}

/** Chỉ nhận ký hiệu có C26 (1C26__, 2C26__, …); còn lại bỏ qua. */
function isSeriesC26(khhdon) {
  const s = String(khhdon || "").trim().toUpperCase();
  return s.includes(SERIES_C26);
}

/**
 * GET GetTypeInvoiceSeries trên 1 domain.
 */
export async function fetchInvoiceSeries(taxCode, domain, authToken) {
  const tax = formatMstForDomain(taxCode, domain);
  const url = `https://${tax}${domain}/api/InvoiceApi78/GetTypeInvoiceSeries`;
  const response = await axios.get(url, {
    headers: {
      Authorization: buildAuthHeader(authToken),
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    timeout: 45000,
    validateStatus: () => true,
  });

  if (response?.data?.code === "00" && Array.isArray(response?.data?.data)) {
    return {
      ok: true,
      domain,
      series: response.data.data,
      error: "",
    };
  }

  return {
    ok: false,
    domain,
    series: [],
    error:
      response?.data?.message ||
      response?.data?.Message ||
      `HTTP ${response.status}`,
  };
}

/**
 * Thử lần lượt .app / .com.vn (hoặc .site) đến khi lấy được series.
 */
export async function fetchInvoiceSeriesAnyDomain(taxCode, authToken) {
  const domains = getCandidateDomains(taxCode);
  let lastError = "";
  for (const domain of domains) {
    try {
      const res = await fetchInvoiceSeries(taxCode, domain, authToken);
      if (res.ok) return res;
      lastError = res.error || lastError;
    } catch (err) {
      lastError = err?.message || "Lỗi kết nối";
    }
  }
  return {
    ok: false,
    domain: domains[0] || "",
    series: [],
    error: lastError || "Không lấy được ký hiệu trên cả 2 domain",
  };
}

/**
 * POST GetInvoices — kiểm tra có HĐ trong khoảng ngày cho 1 ký hiệu.
 */
export async function hasInvoicesInRange(
  taxCode,
  domain,
  khieu,
  { tuNgay, denngay },
  authToken,
) {
  const tax = formatMstForDomain(taxCode, domain);
  const url = `https://${tax}${domain}/api/InvoiceApi78/GetInvoices`;
  const body = {
    tuNgay,
    denngay,
    khieu,
    start: 1,
    coChiTiet: false,
  };

  const response = await axios.post(url, body, {
    headers: {
      Authorization: buildAuthHeader(authToken),
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    timeout: 60000,
    validateStatus: () => true,
  });

  const data = response?.data;
  // Một số tenant trả code "00" + data/list; một số trả mảng trực tiếp
  if (data?.code && data.code !== "00" && String(data.code) !== "0") {
    return { has: false, count: 0, error: data?.message || `code ${data.code}` };
  }

  let items = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data?.data)) items = data.data;
  else if (Array.isArray(data?.data?.data)) items = data.data.data;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (Array.isArray(data?.invoices)) items = data.invoices;

  const count =
    typeof data?.total_count === "number"
      ? data.total_count
      : typeof data?.totalCount === "number"
        ? data.totalCount
        : items.length;

  return { has: count > 0, count, error: "" };
}

/** .app / .site có serial → 2.0, .com.vn có serial → 1.0 */
export function domainToInvoiceVersion(domain) {
  const d = String(domain || "").toLowerCase();
  if (d.includes(".minvoice.app") || d.includes(".minvoice.site")) return "2.0";
  if (d.includes(".minvoice.com.vn")) return "1.0";
  return "";
}

function emptyActivityRow(mst, extra = {}) {
  return {
    mst: mst || "",
    seriesC26: [],
    seriesText: "",
    hasInvoiceLast3Months: false,
    isActive: false,
    domain: "",
    invoiceVersion: "",
    lookMode: extra.lookMode || "invoices",
    months: extra.months || 3,
    pending: false,
    error: "",
    ...extra,
  };
}

/**
 * Tra cứu hoạt động HĐ cho 1 MST.
 * lookMode:
 *  - "invoices": lấy serial C26 rồi check GetInvoices trong N tháng
 *  - "series": chỉ cần lấy được serial → xác định 1.0 / 2.0
 */
export async function lookupInvoiceActivity(taxCode, options = {}) {
  const tax = normalizeMst(taxCode);
  const authToken = options.authToken || "";
  const lookMode = options.lookMode === "series" ? "series" : "invoices";
  const months = Number(options.months) === 6 ? 6 : 3;
  const range = options.range || getLastMonthsRange(months);

  if (!tax) {
    return emptyActivityRow("", { error: "MST không hợp lệ", lookMode, months });
  }

  try {
    const seriesRes = await fetchInvoiceSeriesAnyDomain(tax, authToken);
    if (!seriesRes.ok) {
      return emptyActivityRow(tax, {
        domain: seriesRes.domain,
        lookMode,
        months,
        error: seriesRes.error || "Không lấy được ký hiệu",
      });
    }

    const allSeries = (seriesRes.series || [])
      .map((s) => String(s.khhdon || "").trim())
      .filter(Boolean);
    const seriesC26 = allSeries.filter((kh) => isSeriesC26(kh));
    const uniqueSeries = [...new Set(seriesC26)];
    const invoiceVersion = domainToInvoiceVersion(seriesRes.domain);

    // Chỉ cần lấy serial là đủ xác định phiên bản
    if (lookMode === "series") {
      const seriesText = uniqueSeries.length
        ? uniqueSeries.join(", ")
        : allSeries.join(", ");
      return {
        mst: tax,
        seriesC26: uniqueSeries,
        seriesText,
        hasInvoiceLast3Months: false,
        isActive: allSeries.length > 0,
        domain: seriesRes.domain,
        invoiceVersion,
        lookMode,
        months,
        pending: false,
        error: "",
        range,
      };
    }

    // Chỉ giữ ký hiệu có C26 (1C26__, 2C26__); không C26 → bỏ qua, không gọi GetInvoices
    if (uniqueSeries.length === 0) {
      return emptyActivityRow(tax, {
        domain: seriesRes.domain,
        lookMode,
        months,
        invoiceVersion: "",
      });
    }

    let hasInvoice = false;
    let invoiceError = "";
    for (const khieu of uniqueSeries) {
      try {
        const inv = await hasInvoicesInRange(
          tax,
          seriesRes.domain,
          khieu,
          range,
          authToken,
        );
        if (inv.has) {
          hasInvoice = true;
          break;
        }
        if (inv.error) invoiceError = inv.error;
      } catch (err) {
        invoiceError = err?.message || "Lỗi GetInvoices";
      }
    }

    const isActive = uniqueSeries.length > 0 && hasInvoice;

    return {
      mst: tax,
      seriesC26: uniqueSeries,
      seriesText: uniqueSeries.join(", "),
      hasInvoiceLast3Months: hasInvoice,
      isActive,
      domain: seriesRes.domain,
      invoiceVersion: hasInvoice ? invoiceVersion : "",
      lookMode,
      months,
      pending: false,
      error: hasInvoice ? "" : invoiceError,
      range,
    };
  } catch (err) {
    return emptyActivityRow(tax, {
      lookMode,
      months,
      error: err?.message || "Lỗi không xác định",
    });
  }
}

export async function lookupInvoiceActivityBatch(mstList, options = {}) {
  const concurrency = Math.min(
    10,
    Math.max(1, Number(options.concurrency) || 3),
  );
  const onProgress = options.onProgress;
  const total = mstList.length;
  const results = new Array(total);
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= total) break;
      const mst = mstList[i];
      results[i] = await lookupInvoiceActivity(mst, options);
      completed += 1;
      onProgress?.({
        current: completed,
        total,
        index: i,
        mst,
        row: results[i],
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  );
  return results;
}

export function mapInvoiceActivityToExport(row) {
  const months = Number(row?.months) === 6 ? 6 : 3;
  const seriesOnly = row?.lookMode === "series";
  const invoiceCol = seriesOnly
    ? "Xuất hoá đơn (không kiểm tra)"
    : `Xuất hoá đơn ${months} tháng gần nhất`;
  return {
    "Mã số thuế": row?.mst || "",
    "Danh sách ký hiệu C26 (1C26__/2C26__)": row?.pending
      ? "Đang tra cứu..."
      : row?.seriesText || "",
    [invoiceCol]: row?.pending
      ? "…"
      : seriesOnly
        ? "—"
        : row?.hasInvoiceLast3Months
          ? "Có"
          : "Không",
    "Hoạt động hoá đơn": row?.pending
      ? "…"
      : row?.isActive
        ? "Có"
        : "Không",
    "Phiên bản hoá đơn": row?.pending ? "…" : row?.invoiceVersion || "",
    Domain: row?.pending ? "…" : row?.domain || "",
    "Điều kiện": seriesOnly
      ? "Chỉ lấy serial"
      : `Xuất HĐ ${months} tháng`,
    "Ghi chú": row?.pending ? "Đang tra cứu..." : row?.error || "",
  };
}
