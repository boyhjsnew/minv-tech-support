const PATTERN_AUTH_TOKEN =
  "O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=";

/**
 * Lấy danh sách mẫu hóa đơn (CM0008) theo mã số thuế.
 */
export async function getPatternList(taxCode, { start = 0, count = 50 } = {}) {
  const sanitized = String(taxCode || "")
    .trim()
    .replace(/-/g, "");
  if (!sanitized) {
    throw new Error("Vui lòng nhập mã số thuế");
  }

  const baseUrl = `https://${sanitized}.minvoice.com.vn`;
  const response = await fetch(`${baseUrl}/api/Pattern/GetData`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Accept-Language":
        "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
      Authorization: `Bear ${PATTERN_AUTH_TOKEN}`,
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      Origin: baseUrl,
      Pragma: "no-cache",
      Referer: `${baseUrl}/`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      command: "CM0008",
      start,
      count,
      filter: [],
      tlbparam: [],
    }),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      message = errJson.message || errJson.Message || message;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  const json = await response.json();
  return {
    data: Array.isArray(json?.data) ? json.data : [],
    totalCount: json?.total_count ?? 0,
    pos: json?.pos ?? start,
  };
}
