import axios from "axios";
import qs from "qs";
import GetTokenCRM from "./GetTokenCRM";
import ResetPassword from "./ResetPassword";
import {
  normalizeTaxCode,
  taxCodeWithoutDash,
} from "./CreateUnitBulk";

/** Domain 1.0: luôn bỏ dấu - (0316612746-002 → 0316612746002) */
export function taxCodeForComVn(taxCode) {
  return taxCodeWithoutDash(taxCode);
}

export function buildComVnBaseUrl(taxCode) {
  const tax = taxCodeForComVn(taxCode);
  return tax ? `https://${tax}.minvoice.com.vn` : "";
}

function buildAuthHeader(token) {
  const t = (token || "").toString().trim();
  if (!t) return "";
  if (/^Bear\s+/i.test(t)) return t.includes(";") ? t : `${t};VP;vi`;
  return `Bear ${t};VP;vi`;
}

function buildHeaders(taxCode, token) {
  const baseUrl = buildComVnBaseUrl(taxCode);
  return {
    Accept: "*/*",
    "Accept-Language":
      "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
    Authorization: buildAuthHeader(token),
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Content-Type": "application/json",
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  };
}

/**
 * Đăng nhập 1.0: CRM → ResetPassword → Login ADMINISTRATOR.
 */
export async function loginMinvoice10(taxCode) {
  const tax = normalizeTaxCode(taxCode);
  if (!tax) throw new Error("Vui lòng nhập mã số thuế");

  const storedAccountString = localStorage.getItem("account");
  if (!storedAccountString) {
    throw new Error("Vui lòng đăng nhập CRM trước.");
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
    throw new Error("Vui lòng đăng nhập CRM đầy đủ (username, password, ĐVCS).");
  }

  const tokenCrmRes = await GetTokenCRM(
    storedAccount.username,
    storedAccount.password,
    storedAccount.madvcs,
  );
  if (!tokenCrmRes?.token) {
    throw new Error("Không lấy được token CRM.");
  }

  const resetRes = await ResetPassword(tax, tokenCrmRes.token);
  if (!resetRes?.token) {
    throw new Error(`Không reset được mật khẩu ADMINISTRATOR cho ${tax}.`);
  }

  const sanitized = taxCodeForComVn(tax);
  const loginUrl = `https://${sanitized}.minvoice.com.vn/api/Account/Login`;
  const body = qs.stringify({
    username: "ADMINISTRATOR",
    password: resetRes.token,
    ma_dvcs: "VP",
  });

  const loginRes = await axios.post(loginUrl, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 60000,
  });

  const token = loginRes?.data?.token || loginRes?.data?.access_token;
  if (!token) {
    throw new Error(`Đăng nhập 1.0 thất bại cho ${sanitized}.`);
  }

  return {
    taxCode: tax,
    taxCodeComVn: sanitized,
    token,
    baseUrl: buildComVnBaseUrl(tax),
  };
}

/**
 * GET /api/Pattern/GetData?command=CM0012 — cấu hình đặc thù (tt khác).
 */
export async function fetchSpecialConfig10({
  taxCode,
  token,
  start = 0,
  count = 50,
} = {}) {
  const baseUrl = buildComVnBaseUrl(taxCode);
  if (!baseUrl) throw new Error("Vui lòng nhập mã số thuế nguồn");
  if (!token) throw new Error("Thiếu token đăng nhập 1.0");

  const url = `${baseUrl}/api/Pattern/GetData?command=CM0012&start=${start}&count=${count}&continue=null&filter=null`;
  const res = await axios.get(url, {
    headers: buildHeaders(taxCode, token),
    timeout: 90000,
  });

  const data = res?.data ?? {};
  const items = Array.isArray(data.data) ? data.data : [];
  return {
    items,
    totalCount:
      typeof data.total_count === "number" ? data.total_count : items.length,
    pos: data.pos ?? start,
    raw: data,
  };
}

/**
 * Map item CM0012 → body SaveChangeTTKhac (theo curl).
 */
export function buildSaveTTKhacPayload(item = {}) {
  const to01 = (v) => (v === true || v === 1 || v === "1" ? 1 : 0);
  return {
    vitri: item.vitri || "dp",
    loaihd_id: item.loaihd_id ?? 1,
    ttruong: item.ttruong || "",
    kdlieu: item.kdlieu || "string",
    parrent: item.parrent || "info-invoice",
    type_rows: item.type_rows || "text",
    label: item.label || "",
    label_width: item.label_width ?? 150,
    rows: String(item.rows ?? ""),
    cols: String(item.cols ?? ""),
    format: item.format || "",
    onclick: item.onclick || "",
    onchange: item.onchange || "",
    onselect: item.onselect || "",
    is_use: to01(item.is_use ?? true),
    is_lephi: to01(item.is_lephi),
    is_no_tax_reduce: to01(item.is_no_tax_reduce),
    is_other_reduce: to01(item.is_other_reduce),
    is_readonly: to01(item.is_readonly),
    hidden_in_grid: to01(item.hidden_in_grid),
    hidden_in_form: to01(item.hidden_in_form),
  };
}

/**
 * POST /api/Pattern/SaveChangeTTKhac
 */
export async function saveTTKhac({ taxCode, token, payload } = {}) {
  const baseUrl = buildComVnBaseUrl(taxCode);
  if (!baseUrl) throw new Error("Vui lòng nhập mã số thuế đích");
  if (!token) throw new Error("Thiếu token đăng nhập 1.0 đích");
  if (!payload?.ttruong) throw new Error("Thiếu trường ttruong");

  const res = await axios.post(
    `${baseUrl}/api/Pattern/SaveChangeTTKhac`,
    payload,
    {
      headers: buildHeaders(taxCode, token),
      timeout: 90000,
    },
  );

  return res?.data;
}

/**
 * Copy danh sách cấu hình sang MST đích (đã chọn từ UI).
 */
export async function copySpecialConfigs({
  targetTaxCode,
  items = [],
  shouldStop = () => false,
  onProgress = () => {},
} = {}) {
  if (!items.length) throw new Error("Chưa chọn cấu hình nào để copy");

  const targetLogin = await loginMinvoice10(targetTaxCode);
  onProgress({
    phase: "target-login",
    message: `Đã login đích ${targetLogin.taxCodeComVn}`,
  });

  const logs = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < items.length; i += 1) {
    if (shouldStop()) break;
    const item = items[i];
    const payload = buildSaveTTKhacPayload(item);
    onProgress({
      phase: "saving",
      index: i + 1,
      total: items.length,
      message: `Đang lưu ${payload.ttruong} (${i + 1}/${items.length})…`,
    });

    try {
      const res = await saveTTKhac({
        taxCode: targetTaxCode,
        token: targetLogin.token,
        payload,
      });
      ok += 1;
      logs.push({
        ttruong: payload.ttruong,
        label: payload.label,
        ok: true,
        message: "OK",
        response: res,
      });
    } catch (err) {
      fail += 1;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        err?.message ||
        "Lỗi SaveChangeTTKhac";
      logs.push({
        ttruong: payload.ttruong,
        label: payload.label,
        ok: false,
        message: msg,
        error: err?.response?.data ?? null,
      });
    }
  }

  return {
    ok,
    fail,
    logs,
    target: targetLogin.taxCodeComVn,
    stopped: shouldStop(),
  };
}
