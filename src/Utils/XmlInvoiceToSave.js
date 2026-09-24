/**
 * Parse XML hoá đơn (TDiep / HDon) → JSON Save dạng:
 * { editmode: 1, data: [ { ..., data: [ dòng hàng ] } ] }
 */

function textOf(parent, tagName) {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tagName)[0];
  if (!el) return "";
  return (el.textContent || "").trim();
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}

/** "8%" | "10" | "KCT" → ma_thue Minvoice */
export function parseVatCode(tsuat) {
  const raw = String(tsuat ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!raw) return 8;
  if (raw.includes("KCT") || raw.includes("KKKNT") || raw === "KHONGTHUE")
    return -1;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 8;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 8;
}

function parseXmlDocument(xmlText) {
  let text = String(xmlText || "").trim();
  if (!text) throw new Error("File XML trống");
  text = text.replace(/&(?!(amp|lt|gt|apos|quot|#\d+|#x[\da-fA-F]+);)/g, "&amp;");

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) {
    throw new Error(
      `XML không hợp lệ: ${(err.textContent || "").slice(0, 180)}`,
    );
  }
  return doc;
}

function findInvoiceNodes(doc) {
  const hdonList = Array.from(doc.getElementsByTagName("HDon"));
  if (hdonList.length) return hdonList;
  const dlhdon = Array.from(doc.getElementsByTagName("DLHDon"));
  if (dlhdon.length) return dlhdon;
  const root = doc.documentElement;
  if (root && /hdon|dlhdon/i.test(root.tagName)) return [root];
  return [];
}

function getDlHDon(hdonOrDl) {
  if (!hdonOrDl) return null;
  if (/^dlhdon$/i.test(hdonOrDl.tagName)) return hdonOrDl;
  return hdonOrDl.getElementsByTagName("DLHDon")[0] || hdonOrDl;
}

function mapLineItem(hhdvu, index) {
  const qty = toNumber(textOf(hhdvu, "SLuong"), 0);
  const unitPrice = toNumber(textOf(hhdvu, "DGia"), 0);
  const amountWithoutVat = toNumber(textOf(hhdvu, "ThTien"), qty * unitPrice);
  const discount = toNumber(textOf(hhdvu, "STCKhau"), 0);
  const maThue = parseVatCode(textOf(hhdvu, "TSuat"));
  const vatAmount =
    maThue > 0 ? Math.round((amountWithoutVat * maThue) / 100) : 0;
  const total = amountWithoutVat + vatAmount;
  const tchat = toNumber(textOf(hhdvu, "TChat"), 1);
  const stt = toNumber(textOf(hhdvu, "STT"), index + 1);

  return {
    tchat,
    stt_rec0: stt,
    inv_itemCode: textOf(hhdvu, "MHHDVu") || "",
    inv_itemName: textOf(hhdvu, "THHDVu") || "",
    inv_unitCode: textOf(hhdvu, "DVTinh") || "",
    inv_quantity: qty,
    inv_unitPrice: unitPrice,
    inv_discountPercentage: 0,
    inv_discountAmount: discount,
    inv_TotalAmountWithoutVat: amountWithoutVat,
    ma_thue: maThue,
    inv_vatAmount: vatAmount,
    inv_vatRateDeduction: 0,
    inv_vatAmountDeduction: 0,
    inv_TotalAmount: total,
  };
}

/**
 * Map 1 hoá đơn XML → 1 phần tử trong data[] (format Save có editmode).
 */
export function mapXmlInvoiceToSavePayload(hdonNode) {
  const dl = getDlHDon(hdonNode);
  if (!dl) throw new Error("Không tìm thấy DLHDon trong XML");

  const ttChung =
    dl.getElementsByTagName("TTChung")[0] ||
    hdonNode.getElementsByTagName("TTChung")[0];
  const nd =
    dl.getElementsByTagName("NDHDon")[0] ||
    hdonNode.getElementsByTagName("NDHDon")[0];
  const nBan = nd?.getElementsByTagName("NBan")[0];
  const nMua = nd?.getElementsByTagName("NMua")[0];
  const tToan = nd?.getElementsByTagName("TToan")[0];
  const dshhdvu = nd?.getElementsByTagName("DSHHDVu")[0];

  const lines = Array.from(dshhdvu?.getElementsByTagName("HHDVu") || []).map(
    (node, i) => mapLineItem(node, i),
  );

  const template = textOf(ttChung, "KHMSHDon");
  const khhdon = textOf(ttChung, "KHHDon");
  const series = (() => {
    const mau = String(template || "").trim();
    const kh = String(khhdon || "").trim();
    if (!kh) return mau;
    if (!mau) return kh;
    if (kh.toUpperCase().startsWith(mau.toUpperCase())) return kh;
    return `${mau}${kh}`;
  })();

  const number = toNumber(textOf(ttChung, "SHDon"), 0);
  const issued = textOf(ttChung, "NLap");
  const payment = textOf(ttChung, "HTTToan") || "TM/CK";
  const currency = textOf(ttChung, "DVTTe") || "VND";
  // Tỷ giá mặc định 1 (XML trống / không hợp lệ cũng về 1)
  const exchangeRateRaw = textOf(ttChung, "TGia");
  const exchangeRate =
    exchangeRateRaw === "" ? 1 : toNumber(exchangeRateRaw, 1) || 1;

  const buyerName = textOf(nMua, "Ten");
  const buyerTax = textOf(nMua, "MST");
  const buyerAddr = textOf(nMua, "DChi");
  const buyerTel = textOf(nMua, "SDThoai") || textOf(nBan, "SDThoai") || "";

  const totalWithoutVat = toNumber(
    textOf(tToan, "TgTCThue"),
    lines.reduce((s, l) => s + toNumber(l.inv_TotalAmountWithoutVat), 0),
  );
  const vatAmount = toNumber(
    textOf(tToan, "TgTThue"),
    lines.reduce((s, l) => s + toNumber(l.inv_vatAmount), 0),
  );
  const totalAmount = toNumber(
    textOf(tToan, "TgTTTBSo"),
    totalWithoutVat + vatAmount,
  );

  const dlhdonId = dl.getAttribute("Id") || "";

  return {
    so_benh_an: "",
    inv_invoiceSeries: series,
    inv_InvoiceAuth_id: dlhdonId,
    inv_invoiceIssuedDate: issued,
    inv_invoiceNumber: number || null,
    inv_buyerDisplayName: buyerName || "",
    inv_buyerLegalName: buyerName || "",
    inv_buyerTaxCode: buyerTax || "",
    inv_buyerAddressLine: buyerAddr || "",
    buyerTel: buyerTel || "",
    inv_buyerEmail: textOf(nMua, "DCTDTu") || "",
    inv_TotalAmount: totalAmount,
    inv_TotalAmountWithoutVat: totalWithoutVat,
    inv_paymentMethodName: payment,
    inv_vatAmount: vatAmount,
    inv_currencyCode: currency,
    inv_exchangeRate: exchangeRate,
    tgtck20: 0,
    data: lines,
    _xml: {
      sellerName: textOf(nBan, "Ten"),
      sellerTaxCode: textOf(nBan, "MST"),
      sellerAddress: textOf(nBan, "DChi"),
      template,
      khhdon,
      mccqt: textOf(hdonNode, "MCCQT") || "",
      dlhdonId,
    },
  };
}

export function parseInvoiceXmlText(xmlText, sourceFile = "") {
  const doc = parseXmlDocument(xmlText);
  const nodes = findInvoiceNodes(doc);
  if (!nodes.length) {
    return {
      ok: false,
      sourceFile,
      payloads: [],
      summaries: [],
      error: "Không tìm thấy thẻ HDon/DLHDon trong XML",
    };
  }

  const payloads = [];
  const summaries = [];
  const errors = [];

  nodes.forEach((node, idx) => {
    try {
      const payload = mapXmlInvoiceToSavePayload(node);
      payloads.push(payload);
      summaries.push({
        sourceFile,
        index: idx + 1,
        series: payload.inv_invoiceSeries,
        number: payload.inv_invoiceNumber,
        date: payload.inv_invoiceIssuedDate,
        buyer: payload.inv_buyerLegalName || payload.inv_buyerDisplayName,
        buyerTax: payload.inv_buyerTaxCode,
        lineCount: Array.isArray(payload.data) ? payload.data.length : 0,
        total: payload.inv_TotalAmount,
        sellerTax: payload._xml?.sellerTaxCode || "",
      });
    } catch (err) {
      errors.push(`HĐ #${idx + 1}: ${err?.message || "Lỗi parse"}`);
    }
  });

  return {
    ok: payloads.length > 0,
    sourceFile,
    payloads,
    summaries,
    error: errors.length ? errors.join("; ") : "",
  };
}

export async function parseInvoiceXmlFiles(files) {
  const allPayloads = [];
  const allSummaries = [];
  const fileStats = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const result = parseInvoiceXmlText(text, file.name);
      allPayloads.push(...result.payloads);
      allSummaries.push(...result.summaries);
      fileStats.push({
        name: file.name,
        ok: result.ok,
        count: result.payloads.length,
        error: result.error || (result.ok ? "" : "Không đọc được hoá đơn"),
      });
    } catch (err) {
      fileStats.push({
        name: file.name,
        ok: false,
        count: 0,
        error: err?.message || "Lỗi đọc file",
      });
    }
  }

  return { payloads: allPayloads, summaries: allSummaries, fileStats };
}

/** 1 phần tử data[] sạch (bỏ _xml, có thể bỏ số HĐ). */
export function toSaveDataItem(payload, options = {}) {
  const { _xml, ...rest } = payload || {};
  const item = {
    so_benh_an: rest.so_benh_an ?? "",
    inv_invoiceSeries: rest.inv_invoiceSeries || "",
    inv_InvoiceAuth_id: rest.inv_InvoiceAuth_id || "",
    inv_invoiceIssuedDate: rest.inv_invoiceIssuedDate || "",
    inv_buyerDisplayName: rest.inv_buyerDisplayName || "",
    inv_buyerLegalName: rest.inv_buyerLegalName || "",
    inv_buyerTaxCode: rest.inv_buyerTaxCode || "",
    inv_buyerAddressLine: rest.inv_buyerAddressLine || "",
    buyerTel: rest.buyerTel || "",
    inv_buyerEmail: rest.inv_buyerEmail || "",
    inv_TotalAmount: rest.inv_TotalAmount ?? 0,
    inv_TotalAmountWithoutVat: rest.inv_TotalAmountWithoutVat ?? 0,
    inv_paymentMethodName: rest.inv_paymentMethodName || "TM/CK",
    inv_vatAmount: rest.inv_vatAmount ?? 0,
    inv_currencyCode: rest.inv_currencyCode || "VND",
    inv_exchangeRate: rest.inv_exchangeRate ?? 1,
    tgtck20: rest.tgtck20 ?? 0,
    data: Array.isArray(rest.data) ? rest.data : [],
  };

  // Giữ số HĐ nếu có và không omit (không có trong sample edit nhưng hữu ích khi tạo mới)
  if (!options.omitInvoiceNumber && rest.inv_invoiceNumber != null) {
    item.inv_invoiceNumber = rest.inv_invoiceNumber;
  }

  if (options.series) {
    item.inv_invoiceSeries = options.series;
  }

  return item;
}

/**
 * Body Save đúng format:
 * { editmode: 1, data: [ ... ] }
 */
export function buildSaveRequest(payloads, options = {}) {
  const editmode =
    options.editmode === 0 || options.editmode === "0"
      ? 0
      : Number(options.editmode) || 1;

  const data = (payloads || []).map((p) => toSaveDataItem(p, options));
  return { editmode, data };
}

/** @deprecated dùng buildSaveRequest */
export function toSaveApiBody(payloads, options = {}) {
  return buildSaveRequest(payloads, options).data;
}
