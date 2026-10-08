import axios from "axios";

const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL || "http://localhost:3001"
).replace(/\/+$/, "");

const MST_KEYS = [
  "Mã số thuế",
  "Ma so thue",
  "MST",
  "mst",
  "taxCode",
  "TaxCode",
];

export function normalizeTaxCode(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^0-9-]/g, "");
}

export function parseTaxCodesFromExcel(rows) {
  const values = (rows || [])
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const knownKey = MST_KEYS.find((key) => row[key] !== undefined);
      const value = knownKey ? row[knownKey] : Object.values(row)[0];
      return normalizeTaxCode(value);
    })
    .filter(Boolean);
  return [...new Set(values)];
}

export async function lookupDeclarationContact(taxCode) {
  const mst = normalizeTaxCode(taxCode);
  try {
    const response = await axios.post(
      `${BACKEND_URL}/auth/contacts-by-tax-codes`,
      { taxCodes: [mst] },
      { timeout: 180000 },
    );
    const item = response?.data?.items?.[0];
    if (!item) throw new Error("Backend không trả kết quả cho MST này");
    return {
      mst,
      success: Boolean(item.success),
      version: item.version || "",
      declarationType: item.declarationType || "",
      email: item.email || "",
      phone: item.phone || "",
      declarationDate: item.declarationDate || "",
      error: item.success
        ? ""
        : [item.step, item.error].filter(Boolean).join(": "),
    };
  } catch (error) {
    const data = error?.response?.data;
    return {
      mst,
      success: false,
      version: "",
      declarationType: "",
      email: "",
      phone: "",
      declarationDate: "",
      error:
        data?.message ||
        error?.message ||
        "Không gọi được API backend",
    };
  }
}

export function mapDeclarationContactToExport(row) {
  return {
    "Mã số thuế": row?.mst || "",
    "Phiên bản hóa đơn": row?.version || "",
    "Tờ khai": row?.declarationType || "",
    Email: row?.email || "",
    "Số điện thoại": row?.phone || "",
    "Ngày tờ khai": row?.declarationDate || "",
    "Ghi chú": row?.pending
      ? "Chưa xử lý"
      : row?.success
        ? "Thành công"
        : row?.error || "Tra cứu thất bại",
  };
}
