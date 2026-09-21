/**
 * Proxy tra cứu tình trạng MST — API công khai GDT (tránh CORS trên production).
 * Dùng headers gần giống curl Postman để giảm bị WAF/timeout.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mst = String(req.query.mst || "")
    .trim()
    .replace(/\s+/g, "");

  if (!mst) {
    return res.status(400).json({ error: "Missing mst parameter" });
  }

  const targetUrl = `https://test-qlhd.minvoice.com.vn/api/category/public/dsdkts/${encodeURIComponent(mst)}/manager`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language":
          "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Origin: "https://test-qlhd.minvoice.com.vn",
        Referer: "https://test-qlhd.minvoice.com.vn/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    });

    const text = await response.text();
    res.setHeader("Content-Type", "application/json");
    return res.status(response.status).send(text);
  } catch (error) {
    console.error("GDT lookup proxy error:", error);
    const isAbort = error?.name === "AbortError";
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Gateway Timeout" : "Proxy error",
      message: isAbort
        ? "GDT không phản hồi trong 55s"
        : error.message,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
