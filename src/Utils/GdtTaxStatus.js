import axios from "axios";

const GDT_REFERER = "https://test-qlhd.minvoice.com.vn/";
const GDT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

/** Mã tthai → mô tả tình trạng NNT (theo GDT) */
export const TTHAI_LABELS = {
  "00": "NNT đã được cấp MST — NNT đang hoạt động (đã được cấp GCN ĐKT)",
  "01": "NNT ngừng hoạt động và đã hoàn thành thủ tục chấm dứt hiệu lực MST",
  "02": "NNT đã chuyển cơ quan thuế quản lý",
  "03": "NNT ngừng hoạt động nhưng chưa hoàn thành thủ tục chấm dứt hiệu lực MST",
  "04":
    "NNT đang hoạt động (áp dụng cho hộ kinh doanh, cá nhân kinh doanh chưa đủ thông tin đăng ký thuế) — NNT đang hoạt động (được cấp thông báo MST)",
  "05": "NNT tạm ngừng hoạt động, kinh doanh — NNT tạm nghỉ kinh doanh có thời hạn",
  "06": "NNT không hoạt động tại địa chỉ đã đăng ký",
  "07": "NNT chờ làm thủ tục phá sản",
  /** Thông tư 86/2024/TT-BTC — Phụ lục 1 (bổ sung sau bộ 00–07) */
  "09": "NNT chờ xác minh tình trạng hoạt động tại địa chỉ đã đăng ký",
};

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
    .replace(/[^0-9-]/g, "");
}

export function getTthaiLabel(tthai) {
  const code = String(tthai ?? "")
    .trim()
    .padStart(2, "0");
  return (
    TTHAI_LABELS[code] ||
    `Mã tình trạng ${code} (chưa có trong danh mục tool — tra Phụ lục 1 TT 86/2024)`
  );
}

export function formatGdtAddress(data) {
  if (!data) return "";
  const parts = [
    data.dctsdchi,
    data.dctsxaten,
    data.dctshuyenten,
    data.dctstinhten || data.dctstinh,
  ]
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

export function mapGdtRowToExport(data) {
  if (!data || data.error) {
    return {
      "Tình trạng": data?.error || "Không tra cứu được",
      "Mã số thuế": data?.mst || "",
      "Tên tổ chức, cá nhân": "",
      "Địa chỉ": "",
      "CQT quản lý": "",
    };
  }
  return {
    "Tình trạng": getTthaiLabel(data.tthai),
    "Mã số thuế": data.mst || "",
    "Tên tổ chức, cá nhân": data.tennnt || "",
    "Địa chỉ": formatGdtAddress(data),
    "CQT quản lý": data.tencqt || "",
  };
}

function getValueByPriority(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  const normalizedCandidates = candidates.map((k) =>
    String(k).toLowerCase().replace(/\s+/g, "")
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

/**
 * Đọc danh sách MST từ sheet Excel (cột đầu tiên hoặc cột "Mã số thuế").
 */
export function parseMstListFromExcelRows(jsonData) {
  const seen = new Set();
  const list = [];

  for (const row of jsonData) {
    let raw = getValueByPriority(row, MST_COLUMN_KEYS);
    if (raw == null && Object.keys(row).length > 0) {
      const firstKey = Object.keys(row)[0];
      raw = row[firstKey];
    }
    const mst = normalizeMst(raw);
    if (!mst || seen.has(mst)) continue;
    seen.add(mst);
    list.push(mst);
  }
  return list;
}

function buildLookupUrl(mst) {
  const normalized = normalizeMst(mst);
  if (process.env.NODE_ENV === "development") {
    return `/api/gdt/api/category/public/dsdkts/${encodeURIComponent(normalized)}/manager`;
  }
  return `/api/gdt-tax-lookup?mst=${encodeURIComponent(normalized)}`;
}

/**
 * Tra cứu một MST trên API công khai GDT.
 */
export async function lookupGdtTaxStatus(mst) {
  const normalized = normalizeMst(mst);
  if (!normalized) {
    return { mst: "", error: "MST không hợp lệ" };
  }

  try {
    const response = await axios.get(buildLookupUrl(normalized), {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: GDT_REFERER,
        "User-Agent": GDT_USER_AGENT,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (response.status === 404) {
      return { mst: normalized, error: "Không tìm thấy MST" };
    }
    if (response.status < 200 || response.status >= 300) {
      return {
        mst: normalized,
        error: `HTTP ${response.status}`,
      };
    }

    const data = response.data;
    if (!data || typeof data !== "object") {
      return { mst: normalized, error: "Dữ liệu trả về không hợp lệ" };
    }
    return { ...data, mst: data.mst || normalized };
  } catch (err) {
    return {
      mst: normalized,
      error: err?.message || "Lỗi kết nối API GDT",
    };
  }
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tra cứu danh sách MST — chạy song song theo concurrency (mặc định 8).
 * @param {number} options.concurrency - Số request đồng thời (1–20)
 * @param {number} options.delayMs - Nghỉ thêm sau mỗi request (ms), mặc định 0
 */
export async function lookupGdtTaxStatusBatch(mstList, options = {}) {
  const concurrency = Math.min(
    20,
    Math.max(1, Number(options.concurrency) || 8)
  );
  const delayMs = Math.max(0, Number(options.delayMs) || 0);
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
      results[i] = await lookupGdtTaxStatus(mst);
      completed += 1;

      if (onProgress) {
        onProgress({
          current: completed,
          total,
          mst,
          row: results[i],
        });
      }

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
