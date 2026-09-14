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
    if (!mst || seen.has(mst)) continue;
    seen.add(mst);
    list.push(mst);
  }
  return list;
}

/** Domains cần thử theo 2 phiên bản HĐ */
export function getCandidateDomains(taxCode) {
  const tax = normalizeMst(taxCode);
  if (!tax) return [];
  if (tax.endsWith("-998")) {
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

/** Khoảng 3 tháng gần nhất (tính đến hôm nay). */
export function getLast3MonthsRange(now = new Date()) {
  const denngay = formatYmd(now);
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  const tuNgay = formatYmd(from);
  return { tuNgay, denngay };
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
  const tax = normalizeMst(taxCode);
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
  const tax = normalizeMst(taxCode);
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

/** .app có HĐ → 2.0, .com.vn có HĐ → 1.0 */
export function domainToInvoiceVersion(domain) {
  const d = String(domain || "").toLowerCase();
  if (d.includes(".minvoice.app")) return "2.0";
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
    pending: false,
    error: "",
    ...extra,
  };
}

/**
 * Tra cứu hoạt động HĐ cho 1 MST.
 */
export async function lookupInvoiceActivity(taxCode, options = {}) {
  const tax = normalizeMst(taxCode);
  const authToken = options.authToken || "";
  const range = options.range || getLast3MonthsRange();

  if (!tax) {
    return emptyActivityRow("", { error: "MST không hợp lệ" });
  }

  try {
    const seriesRes = await fetchInvoiceSeriesAnyDomain(tax, authToken);
    if (!seriesRes.ok) {
      return emptyActivityRow(tax, {
        domain: seriesRes.domain,
        error: seriesRes.error || "Không lấy được ký hiệu",
      });
    }

    // Chỉ giữ ký hiệu có C26 (1C26__, 2C26__); không C26 → bỏ qua, không gọi GetInvoices
    const seriesC26 = (seriesRes.series || [])
      .map((s) => String(s.khhdon || "").trim())
      .filter((kh) => kh && isSeriesC26(kh));

    const uniqueSeries = [...new Set(seriesC26)];

    if (uniqueSeries.length === 0) {
      return emptyActivityRow(tax, { domain: seriesRes.domain });
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
    const invoiceVersion = hasInvoice
      ? domainToInvoiceVersion(seriesRes.domain)
      : "";

    return {
      mst: tax,
      seriesC26: uniqueSeries,
      seriesText: uniqueSeries.join(", "),
      hasInvoiceLast3Months: hasInvoice,
      isActive,
      domain: seriesRes.domain,
      invoiceVersion,
      pending: false,
      error: hasInvoice ? "" : invoiceError,
      range,
    };
  } catch (err) {
    return emptyActivityRow(tax, {
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
  return {
    "Mã số thuế": row?.mst || "",
    "Danh sách ký hiệu C26 (1C26__/2C26__)": row?.pending
      ? "Đang tra cứu..."
      : row?.seriesText || "",
    "Xuất hoá đơn 3 tháng gần nhất": row?.pending
      ? "…"
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
    "Ghi chú": row?.pending ? "Đang tra cứu..." : row?.error || "",
  };
}
