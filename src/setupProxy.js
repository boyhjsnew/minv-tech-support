const { createProxyMiddleware } = require("http-proxy-middleware");

/** Dev: proxy API GDT để tránh CORS */
module.exports = function (app) {
  app.use(
    "/api/gdt",
    createProxyMiddleware({
      target: "https://hoadondientu.gdt.gov.vn",
      changeOrigin: true,
      pathRewrite: { "^/api/gdt": "" },
      onProxyReq(proxyReq) {
        proxyReq.setHeader("Referer", "https://test-qlhd.minvoice.com.vn/");
        proxyReq.setHeader(
          "User-Agent",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        );
        proxyReq.setHeader("Accept", "application/json, text/plain, */*");
      },
    })
  );
};
