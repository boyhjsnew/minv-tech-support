const { createProxyMiddleware } = require("http-proxy-middleware");

/** Dev: proxy API GDT (fallback khi gọi thẳng bị CORS) */
module.exports = function (app) {
  app.use(
    "/api/gdt",
    createProxyMiddleware({
      target: "https://hoadondientu.gdt.gov.vn",
      changeOrigin: true,
      secure: true,
      timeout: 60000,
      proxyTimeout: 60000,
      pathRewrite: { "^/api/gdt": "" },
      onProxyReq(proxyReq) {
        proxyReq.setHeader("Origin", "https://test-qlhd.minvoice.com.vn");
        proxyReq.setHeader("Referer", "https://test-qlhd.minvoice.com.vn/");
        proxyReq.setHeader(
          "User-Agent",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
        );
        proxyReq.setHeader("Accept", "application/json, text/plain, */*");
        proxyReq.setHeader(
          "Accept-Language",
          "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
        );
        proxyReq.setHeader("Cache-Control", "no-cache");
        proxyReq.setHeader("Pragma", "no-cache");
      },
    })
  );
};
