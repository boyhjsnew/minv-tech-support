import React, { useState } from "react";
import * as XLSX from "xlsx";

const API_ENDPOINT = "https://api.finan.one/invoice/invoices";
const AUTH_TOKEN =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJGTyBVc2VyIiwic3ViIjoiOGMyNDI4NDAtOWQ4ZC00ZmJmLTk3YjgtZDM3MTlhYjYwNjY5IiwiYXVkIjpbIkZPIFVzZXIiXSwiZXhwIjoxNzY2MzA2NTQwLCJuYmYiOjE3NjM3MTQ1NDAsImlhdCI6MTc2MzcxNDU0MCwib3JnX2lkIjoiMTMxOSIsImJ1c2luZXNzX2lkIjoiMTMyMiIsImRldmljZV9pZCI6ImQxOGE5YTA0LTUzN2UtNGEyNi05ZmJkLWNkNTJlODc3YWNlZCIsInBsYXRmb3JtX2tleSI6IndlYi1lY29tIiwidXNlcl9pZCI6IjhjMjQyODQwLTlkOGQtNGZiZi05N2I4LWQzNzE5YWI2MDY2OSIsImxvZ2luX21ldGhvZCI6InBhc3N3b3JkIiwiYXBwX3ZlcnNpb24iOiIxLjEuMSIsInNlY3VyaXR5X3JvbGUiOjAsInBlcm1pc3Npb25fa2V5cyI6IiIsInJlZnJlc2hfdG9rZW5faWQiOiJmZjIxZjVlNC1kY2NjLTRhNjMtYTBmMi1lNGNiMjBiMmJjZjYifQ.HXVm6kIioMokzOW2cjM9bmabh_L57OiEiCjisp_kMKM";
const DEFAULT_PARAMS = {
  compact: "false",
  from: "2025-09-30T17:00:00.000Z",
  to: "2025-10-31T16:59:59.999Z",
  page_size: "500",
  search: "",
  status: "new",
};

function TestPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);

  const buildUrl = (page) => {
    const params = new URLSearchParams({
      ...DEFAULT_PARAMS,
      page: String(page),
    });
    return `${API_ENDPOINT}?${params.toString()}`;
  };

  const fetchAllOrders = async () => {
    setLoading(true);
    setError("");
    setOrders([]);
    setMeta(null);

    try {
      let currentPage = 1;
      let totalPages = 1;
      const allOrders = [];

      while (currentPage <= totalPages) {
        const response = await fetch(buildUrl(currentPage), {
          method: "GET",
          headers: {
            accept: "*/*",
            "accept-language":
              "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
            authorization: AUTH_TOKEN,
            "cache-control": "no-cache",
            origin: "https://ecom.finan.one",
            pragma: "no-cache",
            priority: "u=1, i",
            referer: "https://ecom.finan.one/",
            "sec-ch-ua":
              '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            "x-locale-code": "vi_VN",
            "x-location-timezone": "Asia/Ho_Chi_Minh",
            "x-platform-key": "desktop-web",
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const result = await response.json();
        const pageData = Array.isArray(result?.data) ? result.data : [];
        const metaInfo = result?.meta;

        allOrders.push(...pageData);
        if (metaInfo) {
          totalPages = metaInfo.pages || 1;
          setMeta(metaInfo);
        }

        currentPage += 1;
      }

      setOrders(allOrders);
    } catch (fetchError) {
      console.error("Fetch orders error:", fetchError);
      setError(fetchError.message || "Có lỗi xảy ra khi lấy dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!orders.length) {
      setError("Không có dữ liệu để xuất Excel");
      return;
    }

    const exportData = orders.map((order) => ({
      order_number: order.order_number,
      order_id: order.order_id,
      partner_name: order.partner_name,
      partner_kind: order.partner_kind,
      total_amount: order.total_amount,
      total_amount_ex: order.total_amount_ex,
      total_discount: order.total_discount,
      payment_method: order.payment_method,
      status: order.status,
      order_date: order.order_date,
      created_at: order.created_at,
      updated_at: order.updated_at,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

    const fileName = `orders_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h2>Danh sách đơn hàng từ API Finan</h2>
      <p>
        API: <code>{API_ENDPOINT}</code>
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <button onClick={fetchAllOrders} disabled={loading}>
          {loading ? "Đang lấy dữ liệu..." : "Lấy toàn bộ đơn hàng"}
        </button>
        <button onClick={exportToExcel} disabled={!orders.length}>
          Xuất Excel ({orders.length})
        </button>
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: "12px" }}>Lỗi: {error}</div>
      )}

      {meta && (
        <div style={{ marginBottom: "12px" }}>
          <strong>Tổng quan:</strong>{" "}
          {`Tổng: ${meta.total} | Số trang: ${meta.pages} | Page Size: ${meta.page_size}`}
        </div>
      )}

      <div style={{ maxHeight: "400px", overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Partner</th>
              <th>Status</th>
              <th>Tổng tiền</th>
              <th>Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.order_number}</td>
                <td>{order.partner_name}</td>
                <td>{order.status}</td>
                <td>{order.total_amount?.toLocaleString("vi-VN")} đ</td>
                <td>
                  {order.created_at
                    ? new Date(order.created_at).toLocaleString("vi-VN")
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TestPage;
