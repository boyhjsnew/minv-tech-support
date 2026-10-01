import axios from "axios";
import {
  buildCreateUnitHeaders,
  buildNetBaseUrl,
  normalizeTaxCode,
} from "./CreateUnitBulk";

export const PAGE_SIZE = 300;
export const SEND_TAX_STATUS_UNSIGNED = 1;

function toIsoDateStart(dateStr) {
  const raw = (dateStr || "").toString().trim();
  if (!raw) return "";
  if (raw.includes("T")) return raw;
  return `${raw}T00:00:00`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse nhiều ký hiệu: xuống dòng / dấu phẩy / chấm phẩy.
 */
export function parseInvoiceSerials(input) {
  if (Array.isArray(input)) {
    return [
      ...new Set(
        input
          .map((s) => String(s ?? "").trim())
          .filter(Boolean),
      ),
    ];
  }
  return [
    ...new Set(
      String(input || "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * baseHost: host tùy chọn (vd hddt.minvoice.com.vn). Rỗng → {mst}.minvoice.net
 */
export function resolveBaseUrl(taxCode, baseHost = "") {
  const host = (baseHost || "")
    .toString()
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (host) return `https://${host}`;
  return buildNetBaseUrl(taxCode);
}

function buildHeaders(taxCode, cookieString, requestVerificationToken, baseUrl) {
  const headers = buildCreateUnitHeaders(taxCode, {
    cookieString,
    requestVerificationToken,
  });
  headers.Referer = `${baseUrl}/`;
  headers.Origin = baseUrl;
  headers["Accept-Language"] = "vi";
  headers["X-Culture"] = "vi";
  return headers;
}

/**
 * GET /api/api/app/summary-report/counter-status-invoice
 * Thống kê theo ký hiệu: waitSign (chờ ký), sending (đang gửi), signed (đã ký).
 */
export async function fetchCounterStatusInvoice({
  taxCode,
  baseHost = "",
  cookieString = "",
  requestVerificationToken = "",
} = {}) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) throw new Error("Vui lòng nhập mã số thuế");

  const baseUrl = resolveBaseUrl(tax, baseHost);
  const headers = buildHeaders(
    tax,
    cookieString,
    requestVerificationToken,
    baseUrl,
  );

  const res = await axios.get(
    `${baseUrl}/api/api/app/summary-report/counter-status-invoice`,
    {
      headers,
      timeout: 60000,
      withCredentials: true,
    },
  );

  const data = res?.data ?? {};
  const details = Array.isArray(data.details) ? data.details : [];

  return {
    dateTimeCount: data.dateTimeCount || null,
    totalWaitSign: Number(data.totalWaitSign) || 0,
    totalSending: Number(data.totalSending) || 0,
    totalSigned: Number(data.totalSigned) || 0,
    details,
    raw: data,
  };
}

/**
 * Lọc ký hiệu theo trạng thái counter.
 * @param {"waitSign"|"sending"|"signed"|"check"} field
 *   - waitSign: chờ ký (ký hàng loạt)
 *   - sending: đang gửi
 *   - signed: đã ký
 *   - check: kiểm tra hàng loạt = signed > 0 hoặc sending > 0
 */
export function pickSerialsFromCounter(details = [], field = "waitSign") {
  const seen = new Set();
  const list = [];
  for (const d of details || []) {
    const serial = String(d?.invoiceSerial || "").trim();
    if (!serial || seen.has(serial)) continue;

    const waitSign = Number(d?.waitSign) || 0;
    const sending = Number(d?.sending) || 0;
    const signed = Number(d?.signed) || 0;

    let match = false;
    if (field === "sending") match = sending > 0;
    else if (field === "signed") match = signed > 0;
    else if (field === "check") match = signed > 0 || sending > 0;
    else match = waitSign > 0;

    if (!match) continue;
    seen.add(serial);
    list.push({
      invoiceSerial: serial,
      waitSign,
      sending,
      signed,
      signOnly: Boolean(d?.signOnly),
    });
  }
  return list;
}

/**
 * GET /api/api/app/invoice/invoice-sign — HĐ chờ ký (sendTaxStatus=1)
 */
export async function fetchInvoiceSignPage({
  taxCode,
  baseHost = "",
  invoiceSerial,
  fromDate,
  toDate,
  maxResultCount = PAGE_SIZE,
  skipCount = 0,
  sendTaxStatus = SEND_TAX_STATUS_UNSIGNED,
  cookieString = "",
  requestVerificationToken = "",
} = {}) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) throw new Error("Vui lòng nhập mã số thuế");
  if (!invoiceSerial) throw new Error("Vui lòng nhập ký hiệu hóa đơn");

  const baseUrl = resolveBaseUrl(tax, baseHost);
  const params = new URLSearchParams({
    maxResultCount: String(maxResultCount),
    skipCount: String(skipCount),
    invoiceSerial: String(invoiceSerial).trim(),
    fromDate: toIsoDateStart(fromDate),
    toDate: toIsoDateStart(toDate),
    inputChange: "toDate",
    sendTaxStatus: String(sendTaxStatus),
  });

  const url = `${baseUrl}/api/api/app/invoice/invoice-sign?${params.toString()}`;
  const headers = buildHeaders(
    tax,
    cookieString,
    requestVerificationToken,
    baseUrl,
  );

  const res = await axios.get(url, {
    headers,
    timeout: 120000,
    withCredentials: true,
  });

  const data = res?.data ?? {};
  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data)
      ? data
      : [];
  const totalCount =
    typeof data.totalCount === "number" ? data.totalCount : items.length;

  return { totalCount, items, raw: data };
}

/**
 * GET /api/api/app/token — danh sách CKS (tokenInfo)
 */
export async function fetchTokenList({
  taxCode,
  baseHost = "",
  cookieString = "",
  requestVerificationToken = "",
} = {}) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) throw new Error("Vui lòng nhập mã số thuế");

  const baseUrl = resolveBaseUrl(tax, baseHost);
  const headers = buildHeaders(
    tax,
    cookieString,
    requestVerificationToken,
    baseUrl,
  );

  const res = await axios.get(`${baseUrl}/api/api/app/token`, {
    headers,
    timeout: 60000,
    withCredentials: true,
  });

  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export function pickDefaultToken(tokens = []) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  return (
    tokens.find((t) => t?.defaultSign === true && t?.used !== false) ||
    tokens.find((t) => t?.used === true) ||
    tokens[0]
  );
}

/**
 * POST /api/api/app/sign-service
 * Body: { signType: "Invoice", ids: string[], tokenInfo }
 */
export async function signInvoices({
  taxCode,
  baseHost = "",
  ids = [],
  tokenInfo,
  cookieString = "",
  requestVerificationToken = "",
} = {}) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) throw new Error("Vui lòng nhập mã số thuế");
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Không có hóa đơn để ký");
  }
  if (!tokenInfo || !tokenInfo.id) {
    throw new Error("Thiếu thông tin chữ ký số (tokenInfo)");
  }

  const baseUrl = resolveBaseUrl(tax, baseHost);
  const headers = buildHeaders(
    tax,
    cookieString,
    requestVerificationToken,
    baseUrl,
  );

  const body = {
    signType: "Invoice",
    ids,
    tokenInfo,
  };

  const res = await axios.post(`${baseUrl}/api/api/app/sign-service`, body, {
    headers,
    timeout: 300000,
    withCredentials: true,
  });

  return res?.data;
}

/**
 * Chờ batch vừa ký biến mất khỏi danh sách chờ ký (sendTaxStatus=1).
 */
async function waitUntilBatchCleared({
  signedIds,
  fetchPage,
  shouldStop = () => false,
  onProgress = () => {},
  round = 0,
  pollIntervalMs = 2000,
  maxWaitMs = 180000,
} = {}) {
  const idSet = new Set(signedIds || []);
  if (idSet.size === 0) return true;

  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    if (shouldStop()) return false;
    await sleep(pollIntervalMs);
    if (shouldStop()) return false;

    const page = await fetchPage();
    const stillThere = (page.items || []).some((it) => idSet.has(it?.id));
    onProgress({
      round,
      totalRemaining: page.totalCount,
      batchSize: signedIds.length,
      phase: "waiting",
      message: stillThere
        ? `Vòng ${round}: đang chờ CKS xử lý (${signedIds.length} HĐ)…`
        : `Vòng ${round}: batch đã rời danh sách chờ ký`,
    });

    if (!stillThere) return true;
  }

  return false;
}

/**
 * Đếm HĐ chờ ký cho nhiều ký hiệu.
 */
export async function fetchInvoiceSignTotalsForSerials({
  taxCode,
  baseHost = "",
  invoiceSerials,
  fromDate,
  toDate,
  cookieString = "",
  requestVerificationToken = "",
} = {}) {
  const serials = parseInvoiceSerials(invoiceSerials);
  if (serials.length === 0) {
    throw new Error("Vui lòng nhập ít nhất một ký hiệu hóa đơn");
  }

  const results = [];
  for (const serial of serials) {
    const page = await fetchInvoiceSignPage({
      taxCode,
      baseHost,
      invoiceSerial: serial,
      fromDate,
      toDate,
      maxResultCount: 5,
      skipCount: 0,
      cookieString,
      requestVerificationToken,
    });
    results.push({
      serial,
      totalCount: page.totalCount,
      sample: (page.items || []).slice(0, 3).map((it) => ({
        id: it.id,
        invoiceNumber: it.invoiceNumber,
        totalAmount: it.totalAmount,
        buyerDisplayName: it.buyerDisplayName,
      })),
    });
  }

  return {
    results,
    totalCount: results.reduce((sum, r) => sum + (r.totalCount || 0), 0),
  };
}

/**
 * Vòng lặp 1 ký hiệu: lấy page → ký → chờ batch → lặp đến hết.
 */
async function runBulkSignLoopForSerial({
  taxCode,
  baseHost = "",
  invoiceSerial,
  fromDate,
  toDate,
  tokenInfo,
  cookieString = "",
  requestVerificationToken = "",
  pageSize = PAGE_SIZE,
  shouldStop = () => false,
  onProgress = () => {},
  signedTotalStart = 0,
  roundOffset = 0,
} = {}) {
  let round = 0;
  let signedTotal = signedTotalStart;
  let lastTotalCount = null;
  const logs = [];
  let prevFingerprint = "";
  let staleRounds = 0;

  const fetchPage = () =>
    fetchInvoiceSignPage({
      taxCode,
      baseHost,
      invoiceSerial,
      fromDate,
      toDate,
      maxResultCount: pageSize,
      skipCount: 0,
      cookieString,
      requestVerificationToken,
    });

  while (!shouldStop()) {
    round += 1;
    const globalRound = roundOffset + round;

    const page = await fetchPage();
    lastTotalCount = page.totalCount;
    const ids = (page.items || [])
      .map((it) => it?.id)
      .filter((id) => typeof id === "string" && id.length > 0);

    onProgress({
      round: globalRound,
      invoiceSerial,
      totalRemaining: page.totalCount,
      batchSize: ids.length,
      signedTotal,
      phase: "listed",
      message: `[${invoiceSerial}] Vòng ${round}: còn ${page.totalCount} HĐ, lấy ${ids.length} để ký`,
    });

    if (ids.length === 0) {
      logs.push({
        round: globalRound,
        invoiceSerial,
        ok: true,
        signed: 0,
        remaining: page.totalCount,
        message: `[${invoiceSerial}] Không còn hóa đơn chờ ký`,
      });
      break;
    }

    const fingerprint = `${page.totalCount}:${ids[0]}:${ids[ids.length - 1]}`;
    if (fingerprint === prevFingerprint) {
      staleRounds += 1;
      if (staleRounds >= 3) {
        const msg = `[${invoiceSerial}] Danh sách chờ ký không đổi — dừng để tránh ký trùng.`;
        logs.push({
          round: globalRound,
          invoiceSerial,
          ok: false,
          signed: 0,
          remaining: page.totalCount,
          message: msg,
        });
        throw new Error(msg);
      }
    } else {
      staleRounds = 0;
      prevFingerprint = fingerprint;
    }

    if (shouldStop()) break;

    try {
      const signRes = await signInvoices({
        taxCode,
        baseHost,
        ids,
        tokenInfo,
        cookieString,
        requestVerificationToken,
      });

      signedTotal += ids.length;
      logs.push({
        round: globalRound,
        invoiceSerial,
        ok: true,
        signed: ids.length,
        remaining: Math.max(0, page.totalCount - ids.length),
        message: `[${invoiceSerial}] Đã gửi ký ${ids.length} HĐ`,
        response: signRes,
      });

      onProgress({
        round: globalRound,
        invoiceSerial,
        totalRemaining: Math.max(0, page.totalCount - ids.length),
        batchSize: ids.length,
        signedTotal,
        phase: "signed",
        message: `[${invoiceSerial}] Vòng ${round}: đã gửi ký ${ids.length} HĐ (tổng: ${signedTotal})`,
        response: signRes,
      });

      const cleared = await waitUntilBatchCleared({
        signedIds: ids,
        fetchPage,
        shouldStop,
        onProgress: (p) =>
          onProgress({
            ...p,
            invoiceSerial,
            signedTotal,
            message: p.message?.startsWith("[")
              ? p.message
              : `[${invoiceSerial}] ${p.message || ""}`,
          }),
        round: globalRound,
      });

      if (!cleared && !shouldStop()) {
        onProgress({
          round: globalRound,
          invoiceSerial,
          totalRemaining: page.totalCount,
          batchSize: ids.length,
          signedTotal,
          phase: "waiting",
          message: `[${invoiceSerial}] Hết thời gian chờ batch — tiếp tục vòng sau`,
        });
        await sleep(1500);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi khi gọi sign-service";
      logs.push({
        round: globalRound,
        invoiceSerial,
        ok: false,
        signed: 0,
        remaining: page.totalCount,
        message: `[${invoiceSerial}] ${msg}`,
        error: err?.response?.data ?? null,
      });
      onProgress({
        round: globalRound,
        invoiceSerial,
        totalRemaining: page.totalCount,
        batchSize: ids.length,
        signedTotal,
        phase: "error",
        message: `[${invoiceSerial}] Vòng ${round} lỗi: ${msg}`,
      });
      throw err;
    }
  }

  return {
    signedTotal,
    rounds: round,
    lastTotalCount,
    stopped: shouldStop(),
    logs,
    invoiceSerial,
  };
}

/**
 * Ký hàng loạt nhiều ký hiệu: lần lượt từng serial đến khi hết.
 */
export async function runBulkSignLoop({
  taxCode,
  baseHost = "",
  invoiceSerial,
  invoiceSerials,
  fromDate,
  toDate,
  tokenInfo,
  cookieString = "",
  requestVerificationToken = "",
  pageSize = PAGE_SIZE,
  shouldStop = () => false,
  onProgress = () => {},
} = {}) {
  const serials = parseInvoiceSerials(
    invoiceSerials?.length ? invoiceSerials : invoiceSerial,
  );
  if (serials.length === 0) {
    throw new Error("Vui lòng nhập ít nhất một ký hiệu hóa đơn");
  }

  let signedTotal = 0;
  let roundOffset = 0;
  let lastTotalCount = 0;
  const logs = [];
  const perSerial = [];

  for (let i = 0; i < serials.length; i += 1) {
    if (shouldStop()) break;
    const serial = serials[i];

    onProgress({
      round: roundOffset,
      invoiceSerial: serial,
      serialIndex: i + 1,
      serialTotal: serials.length,
      signedTotal,
      phase: "serial-start",
      message: `Bắt đầu ký hiệu ${serial} (${i + 1}/${serials.length})…`,
    });

    const result = await runBulkSignLoopForSerial({
      taxCode,
      baseHost,
      invoiceSerial: serial,
      fromDate,
      toDate,
      tokenInfo,
      cookieString,
      requestVerificationToken,
      pageSize,
      shouldStop,
      signedTotalStart: signedTotal,
      roundOffset,
      onProgress: (p) =>
        onProgress({
          ...p,
          serialIndex: i + 1,
          serialTotal: serials.length,
        }),
    });

    signedTotal = result.signedTotal;
    roundOffset += result.rounds;
    lastTotalCount = result.lastTotalCount;
    logs.push(...result.logs);
    perSerial.push({
      serial,
      signed: result.logs
        .filter((l) => l.ok && l.signed > 0)
        .reduce((s, l) => s + l.signed, 0),
      lastTotalCount: result.lastTotalCount,
      rounds: result.rounds,
    });
  }

  return {
    signedTotal,
    rounds: roundOffset,
    lastTotalCount,
    stopped: shouldStop(),
    logs,
    serials,
    perSerial,
  };
}
