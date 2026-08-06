import axios from "axios";
import GetTokenCRM from "./GetTokenCRM";
import ResetPasswordNewApp from "./ResetPasswordNewApp";
import {
  generateGetCookiesScript,
  getCookiesFromStorage,
  saveCookiesToStorage,
} from "./GetCookiesFromWindow";

const CODE_COLUMN_KEYS = [
  "Mã hàng",
  "Ma hang",
  "Mã DVT",
  "Ma DVT",
  "Mã",
  "Ma",
  "code",
  "Code",
];

const NAME_COLUMN_KEYS = [
  "Tên DVT",
  "Ten DVT",
  "Tên DTV",
  "Ten DTV",
  "Tên",
  "Ten",
  "name",
  "Name",
  "Đơn vị tính",
  "Don vi tinh",
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

export function normalizeTaxCode(taxCode) {
  return (taxCode || "").toString().trim().replace(/\s+/g, "");
}

export function buildNetBaseUrl(taxCode) {
  const tax = normalizeTaxCode(taxCode);
  return tax ? `https://${tax}.minvoice.net` : "";
}

export function extractXsrfTokenFromCookieString(cookieString) {
  const source = (cookieString || "").toString();
  if (!source) return "";
  const parts = source.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split("=");
    const key = (name || "").trim();
    if (key !== "XSRF-TOKEN" && key !== "RequestVerificationToken") continue;
    const raw = rest.join("=").trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
}

export function extractTenantFromCookie(cookieString) {
  const source = (cookieString || "").toString();
  const match = source.match(/(?:^|;\s*)__tenant=([^;]+)/i);
  return match ? decodeURIComponent(match[1].trim()) : "";
}

/**
 * Đọc Excel: cột mã hàng (code) + tên DVT (name).
 */
export function parseUnitRowsFromExcel(jsonData) {
  const rows = [];
  const keys = jsonData?.[0] ? Object.keys(jsonData[0]) : [];

  for (const row of jsonData) {
    let codeRaw = getValueByPriority(row, CODE_COLUMN_KEYS);
    let nameRaw = getValueByPriority(row, NAME_COLUMN_KEYS);

    if (codeRaw == null && keys[0]) codeRaw = row[keys[0]];
    if (nameRaw == null && keys[1]) nameRaw = row[keys[1]];

    const code = codeRaw == null ? "" : String(codeRaw).trim();
    const name = nameRaw == null ? "" : String(nameRaw).trim();
    if (!code || !name) continue;

    rows.push({ code, name });
  }

  return rows;
}

/**
 * Lấy tài khoản 2.0 từ CRM (giống các tool ngách khác).
 */
export async function fetchAccount20(taxCode) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) throw new Error("Vui lòng nhập mã số thuế");

  const storedAccountString = localStorage.getItem("account");
  if (!storedAccountString) {
    throw new Error("Vui lòng đăng nhập CRM trước (trang Đăng nhập CRM).");
  }

  let storedAccount;
  try {
    storedAccount = JSON.parse(storedAccountString);
  } catch {
    throw new Error("Dữ liệu đăng nhập CRM không hợp lệ.");
  }

  if (
    !storedAccount?.username ||
    !storedAccount?.password ||
    !storedAccount?.madvcs
  ) {
    throw new Error(
      "Vui lòng đăng nhập CRM đầy đủ (username, password, mã ĐVCS).",
    );
  }

  const tokenCrmRes = await GetTokenCRM(
    storedAccount.username,
    storedAccount.password,
    storedAccount.madvcs,
  );
  if (!tokenCrmRes?.token) {
    throw new Error("Không lấy được token CRM.");
  }

  const tokenNewApp = await ResetPasswordNewApp(tax, tokenCrmRes.token);
  if (!tokenNewApp?.token?.data) {
    throw new Error("Không lấy được tài khoản 2.0 cho MST này.");
  }

  return {
    taxCode: tax,
    account: tokenNewApp.token.data.account,
    password: tokenNewApp.token.data.passWord,
    netUrl: buildNetBaseUrl(tax),
  };
}

/**
 * Mở link .minvoice.net và lắng nghe cookie (postMessage / localStorage).
 */
export function openNetLoginAndListenCookies(taxCode, onCookies) {
  const tax = normalizeTaxCode(taxCode);
  const url = `${buildNetBaseUrl(tax)}/#/`;
  const newWindow = window.open(url, "_blank");

  const messageHandler = (event) => {
    if (
      event.data?.type === "COOKIES_SAVED" &&
      event.data?.taxCode === tax &&
      event.data?.cookies
    ) {
      saveCookiesToStorage(tax, event.data.cookies);
      onCookies?.(event.data.cookies);
    }
  };
  window.addEventListener("message", messageHandler);

  const storagePoll = setInterval(() => {
    const cookies = getCookiesFromStorage(tax);
    if (cookies) {
      onCookies?.(cookies);
    }
  }, 2000);

  setTimeout(() => {
    window.removeEventListener("message", messageHandler);
    clearInterval(storagePoll);
  }, 300000);

  return {
    window: newWindow,
    cookieScript: generateGetCookiesScript(tax),
    cleanup: () => {
      window.removeEventListener("message", messageHandler);
      clearInterval(storagePoll);
    },
  };
}

export function getStoredCookies(taxCode) {
  return getCookiesFromStorage(normalizeTaxCode(taxCode)) || "";
}

export function buildCreateUnitHeaders(
  taxCode,
  { cookieString = "", requestVerificationToken = "" } = {},
) {
  const baseUrl = buildNetBaseUrl(taxCode);
  const cookies = cookieString || getStoredCookies(taxCode);
  const xsrf =
    (requestVerificationToken || "").trim() ||
    extractXsrfTokenFromCookieString(cookies);
  const tenant = extractTenantFromCookie(cookies);

  // Giống IntrustMultipe / InsertCKS: cookie phiên đăng nhập tab .net
  // được browser gửi tự động nhờ withCredentials: true
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Referer: `${baseUrl}/`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "sec-ch-ua":
      '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };

  // Nếu có XSRF (từ storage / dán tay) thì gắn thêm; không bắt buộc
  if (xsrf) {
    headers.RequestVerificationToken = xsrf;
  }
  if (tenant) {
    headers.__tenant = tenant;
  }

  return headers;
}

/**
 * POST https://{mst}.minvoice.net/api/api/app/unit
 */
export async function createUnit(
  { code, name },
  { taxCode, cookieString = "", requestVerificationToken = "" } = {},
) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) {
    return {
      code,
      name,
      ok: false,
      data: null,
      error: "Thiếu mã số thuế",
    };
  }

  const baseUrl = buildNetBaseUrl(tax);
  const url = `${baseUrl}/api/api/app/unit`;
  const body = { code, name, inputChange: "name" };

  try {
    const response = await axios.post(url, body, {
      headers: buildCreateUnitHeaders(tax, {
        cookieString,
        requestVerificationToken,
      }),
      timeout: 60000,
      withCredentials: true,
    });
    return {
      code,
      name,
      ok: true,
      data: response.data,
      error: "",
    };
  } catch (err) {
    return {
      code,
      name,
      ok: false,
      data: err?.response?.data ?? null,
      error:
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        err?.message ||
        "Lỗi không xác định",
    };
  }
}

export async function createUnitBatch(
  items,
  {
    taxCode,
    concurrency = 3,
    delayMs = 150,
    cookieString = "",
    requestVerificationToken = "",
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
          code: item.code,
          name: item.name,
        });

        results[current] = await createUnit(item, {
          taxCode,
          cookieString,
          requestVerificationToken,
        });
        done += 1;
        onProgress?.({
          current: done,
          total: items.length,
          code: item.code,
          name: item.name,
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

export function mapCreateUnitRowToExport(row) {
  return {
    "Mã hàng": row?.code || "",
    "Tên DVT": row?.name || "",
    "Trạng thái": row?.ok ? "Thành công" : "Thất bại",
    "Thông báo": row?.error || "",
    "Kết quả (JSON)":
      row?.data != null
        ? typeof row.data === "string"
          ? row.data
          : JSON.stringify(row.data)
        : "",
  };
}
