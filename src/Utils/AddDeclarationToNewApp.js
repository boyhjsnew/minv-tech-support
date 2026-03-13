import axios from "axios";

// Endpoint 2.0 để đăng ký tờ khai (theo curl declare-register-invoice)
const DECLARATION_REGISTER_PATH = "/api/api/app/declare-register-invoice";

// Danh sách partner mặc định (M-INVOICE) khi 1.0 không trả về partners
const DEFAULT_PARTNERS = [
  {
    partnerName: "CÔNG TY TNHH HÓA ĐƠN ĐIỆN TỬ M-INVOICE",
    partnerTaxCode: "0106026495",
    fromDate: "2026-03-05",
    toDate: null,
    note: "",
    type: 0,
    declarationRegisterId: "3a1fd076-d8db-3117-dfd9-378aff597f3a",
    default: false,
    id: "3a1fd076-d901-4100-84ba-017705f7260c",
  },
  {
    partnerName: "CÔNG TY TNHH HÓA ĐƠN ĐIỆN TỬ M-INVOICE",
    partnerTaxCode: "0106026495",
    fromDate: "2026-03-05",
    toDate: null,
    note: "",
    type: 1,
    declarationRegisterId: "3a1fd076-d8db-3117-dfd9-378aff597f3a",
    default: false,
    id: "3a1fd076-d901-8411-3825-9931e4de54c0",
  },
];

/**
 * Map dữ liệu tờ khai 1.0 (GetMau01Detail / list CM0006) sang payload 2.0.
 * GetMau01Detail trả về { code, message, data } với data có: mst, tnnt, nlap, reg_giaiphaps, reg_tvans, ...
 * @param {Object} declaration1 - data từ Register68/GetMau01Detail hoặc item từ list CM0006
 * @returns {Object} Payload đúng format 2.0
 */
export function mapDeclaration1To2(declaration1) {
  if (!declaration1) return null;

  const d = declaration1;
  const mst = (d.mst || "").toString().trim();

  // formInvoice: CMa, CMTMTTien, KMa theo giá trị 1.0
  const formParts = [];
  if (d.cma === 1 || d.cma === 1.0) formParts.push("CMa");
  if (d.cmtmttien === 1 || d.cmtmttien === 1.0) formParts.push("CMTMTTien");
  if (d.kcma === 1 || d.kcma === 1.0) formParts.push("KMa");
  const formInvoice = formParts.length ? formParts.join(",") : "CMa,CMTMTTien,KMa";

  // method: CDDu hoặc CBTHop
  const method = d.cddu === 1 || d.cddu === 1.0 ? "CDDu" : "CBTHop";

  // invoiceTypeUse: GTGT, HDBH, HDBTSCong, HDBHDTQGia, HDKhac, CTu
  const typeParts = [];
  if (d.hdgtgt === 1 || d.hdgtgt === 1.0) typeParts.push("GTGT");
  if (d.hdbhang === 1 || d.hdbhang === 1.0) typeParts.push("HDBH");
  if (d.hdbtscong === 1 || d.hdbtscong === 1.0) typeParts.push("HDBTSCong");
  if (d.hdbhdtqgia === 1 || d.hdbhdtqgia === 1.0) typeParts.push("HDBHDTQGia");
  if (d.hdkhac === 1 || d.hdkhac === 1.0) typeParts.push("HDKhac");
  if (d.ctu === 1 || d.ctu === 1.0) typeParts.push("CTu");
  const invoiceTypeUse = typeParts.length ? typeParts.join(",") : "GTGT,HDBH,HDBTSCong,HDBHDTQGia";

  const nlap = d.nlap ? (typeof d.nlap === "string" ? d.nlap : d.nlap) : null;
  const nsddpluat = d.nsddpluat ? (typeof d.nsddpluat === "string" ? d.nsddpluat : d.nsddpluat) : null;

  const payload = {
    cityCode: (d.mcqtqly || "").toString().trim() || "10100",
    cityName: (d.cqtqly || "").toString().trim() || "Thuế Thành phố Hà Nội",
    taxAuthorityCode: (d.mcqtqly || "").toString().trim(),
    formality: typeof d.hthuc === "number" ? d.hthuc : 2,
    dateCreate: nlap || new Date().toISOString().slice(0, 19),
    region: (d.ddanh || "").toString().trim(),
    taxpayers: (d.tnnt || "").toString().trim(),
    taxCode: mst.replace(/-998$/, "").trim() || mst,
    taxAuthorityName: (d.cqtqly || "").toString().trim(),
    legalRepName: (d.tnddpluat || d.nlhe || "").toString().trim(),
    legalRepPhone: (d.dtddpluat || d.dtlhe || "").toString().trim(),
    legalRepPassport: (d.cccdan || d.dtddpluat || d.dtlhe || "").toString().trim(),
    legalRepDob: nsddpluat || null,
    legalRepGender: d.gtinh === 1 || d.gtinh === 1.0 ? 1 : 0,
    personContact: (d.nlhe || "").toString().trim(),
    phone: (d.dtlhe || "").toString().trim(),
    address: (d.dclhe || "").toString().trim(),
    email: (d.dctdtu || "").toString().trim(),
    formInvoice,
    formSendData: "",
    method,
    invoiceTypeUse,
    inputChange: "legalRepGender",
    partners: (() => {
      const list = mapPartnersFrom1(d);
      return list.length > 0 ? list : DEFAULT_PARTNERS;
    })(),
    token: [],
  };

  return payload;
}

/**
 * Lấy fromDate dạng YYYY-MM-DD từ chuỗi datetime 1.0.
 */
function toDateOnly(val) {
  if (val == null) return null;
  const s = typeof val === "string" ? val : String(val);
  if (s.length >= 10) return s.slice(0, 10);
  return s || null;
}

/**
 * Nếu 1.0 trả về partners (partners, reg_giaiphaps, reg_tvans), map sang format 2.0.
 * Format 2.0: { partnerName, partnerTaxCode, fromDate, toDate, note, type, declarationRegisterId?, default?, id? }
 * GetMau01Detail: reg_giaiphaps (TCGP) -> type 0, reg_tvans (TCTN) -> type 1.
 */
function mapPartnersFrom1(d) {
  if (Array.isArray(d.partners) && d.partners.length > 0) {
    return d.partners.map((p) => ({
      partnerName: p.partnerName ?? p.ten ?? "",
      partnerTaxCode: p.partnerTaxCode ?? p.mst ?? "",
      fromDate: toDateOnly(p.fromDate ?? p.tu_ngay ?? p.tngay),
      toDate: toDateOnly(p.toDate ?? p.den_ngay ?? p.dngay),
      note: p.note ?? p.ghi_chu ?? p.gchu ?? "",
      type: typeof p.type === "number" ? p.type : 0,
      declarationRegisterId: p.declarationRegisterId ?? p.reg_dauphieu_id ?? p.id ?? null,
      default: !!p.default,
      id: p.reg_giaiphap_id ?? p.reg_tvan_id ?? p.id ?? null,
    }));
  }
  const partners = [];
  if (Array.isArray(d.reg_giaiphaps)) {
    d.reg_giaiphaps.forEach((p) => {
      partners.push({
        partnerName: (p.ten_tcgp || "").toString().trim(),
        partnerTaxCode: (p.mst_tcgp || "").toString().trim(),
        fromDate: toDateOnly(p.tngay),
        toDate: toDateOnly(p.dngay),
        note: (p.gchu || "").toString().trim(),
        type: 0,
        declarationRegisterId: d.reg_dauphieu_id ?? null,
        default: false,
        id: p.reg_giaiphap_id ?? null,
      });
    });
  }
  if (Array.isArray(d.reg_tvans)) {
    d.reg_tvans.forEach((p) => {
      partners.push({
        partnerName: (p.ten_tctn || "").toString().trim(),
        partnerTaxCode: (p.mst_tctn || "").toString().trim(),
        fromDate: toDateOnly(p.tngay),
        toDate: toDateOnly(p.dngay),
        note: (p.gchu || "").toString().trim(),
        type: 1,
        declarationRegisterId: d.reg_dauphieu_id ?? null,
        default: false,
        id: p.reg_tvan_id ?? null,
      });
    });
  }
  return partners;
}

/**
 * Lấy danh sách token (CKS) từ app 2.0 để gắn vào payload tờ khai.
 * Dùng cookie phiên đăng nhập 2.0 (withCredentials).
 */
export async function getTokenListFromNewApp(taxCode) {
  const baseUrl = `https://${taxCode}.minvoice.net`;
  try {
    const res = await axios.get(`${baseUrl}/api/api/app/token`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Referer: `${baseUrl}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
      withCredentials: true,
    });
    const data = res?.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (err) {
    console.warn("Không lấy được danh sách token 2.0:", err?.response?.status, err?.message);
    return [];
  }
}

/**
 * Gửi tờ khai (payload 2.0) lên app 2.0.
 * Theo curl: declare-register-invoice, cookie + RequestVerificationToken (XSRF).
 * @param {string} taxCode - MST (có thể dạng 0106026495-998 hoặc 3603253486)
 * @param {Object} payload - Payload tờ khai đúng format 2.0 (có thể đã gắn token từ getTokenListFromNewApp)
 * @param {{ accessToken?: string, requestVerificationToken?: string }} options - requestVerificationToken: giá trị cookie XSRF-TOKEN (để tránh 302)
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
export async function addDeclarationToNewApp(taxCode, payload, options = {}) {
  const baseUrl = `https://${taxCode}.minvoice.net`;
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    Connection: "keep-alive",
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };
  let xsfrToken = options.requestVerificationToken?.trim();
  if (!xsfrToken && typeof document !== "undefined" && document.cookie) {
    const match = document.cookie.match(/\bXSRF-TOKEN=([^;]+)/);
    if (match) {
      try {
        xsfrToken = decodeURIComponent(match[1].trim());
      } catch {
        xsfrToken = match[1].trim();
      }
    }
  }
  if (xsfrToken) {
    headers.RequestVerificationToken = xsfrToken;
  }
  if (options.accessToken && options.accessToken.trim()) {
    const token = options.accessToken.trim();
    headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  try {
    const res = await axios.post(
      `${baseUrl}${DECLARATION_REGISTER_PATH}`,
      payload,
      {
        headers,
        withCredentials: true,
        maxRedirects: 0, // không follow 302 để tránh redirect sang login/404
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );
    return { success: true, data: res.data };
  } catch (err) {
    const status = err?.response?.status;
    const location = err?.response?.headers?.location;
    let msg =
      err?.response?.data?.message ||
      err?.response?.data?.Message ||
      err?.message ||
      "Lỗi không xác định";
    if (status === 302 || status === 301) {
      msg =
        "Phiên đăng nhập 2.0 không được gửi kèm request (302). " +
        "Nếu bạn gọi từ domain khác (vd. localhost), cookie 2.0 có thể không gửi. " +
        "Hãy đăng nhập lại trang 2.0 trong tab đã mở, hoặc cung cấp accessToken 2.0 nếu API hỗ trợ.";
      if (location) msg += ` Redirect: ${location}`;
    }
    console.error("addDeclarationToNewApp error:", status, msg);
    return { success: false, error: msg };
  }
}

/**
 * Luồng đầy đủ: map tờ khai 1.0 -> lấy token 2.0 -> gửi tờ khai lên 2.0.
 * Gọi sau khi đã thêm CKS và đã lấy được thông tin tờ khai từ 1.0.
 * @param {string} taxCode - MST
 * @param {Object} declaration1 - Dữ liệu tờ khai 1.0 (item list hoặc GetRegisterInvoice)
 */
export async function fetchDeclarationFrom1AndAddTo2(taxCode, declaration1) {
  const payload = mapDeclaration1To2(declaration1);
  if (!payload) {
    console.warn("Không map được payload tờ khai 2.0 từ dữ liệu 1.0.");
    return { success: false, error: "Dữ liệu tờ khai 1.0 không hợp lệ." };
  }

  const tokens = await getTokenListFromNewApp(taxCode);
  payload.token = Array.isArray(tokens) ? tokens : [];

  return addDeclarationToNewApp(taxCode, payload);
}
