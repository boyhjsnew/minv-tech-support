/**
 * Proxy tra cứu tình trạng MST — API công khai GDT (tránh CORS trên production).
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

  const targetUrl = `https://hoadondientu.gdt.gov.vn/api/category/public/dsdkts/${encodeURIComponent(mst)}/manager`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://test-qlhd.minvoice.com.vn/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    });

    const text = await response.text();
    res.setHeader("Content-Type", "application/json");
    return res.status(response.status).send(text);
  } catch (error) {
    console.error("GDT lookup proxy error:", error);
    return res.status(500).json({
      error: "Proxy error",
      message: error.message,
    });
  }
}
