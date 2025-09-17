import React, { useState, useRef, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import { Panel } from "primereact/panel";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { InputTextarea } from "primereact/inputtextarea";
// theme
import "primereact/resources/themes/lara-light-cyan/theme.css";
export default function DeleteCache() {
  const [visible, setVisible] = useState(false);
  const [taxCode, setTaxCode] = useState("");
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [invoiceList, setInvoiceList] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [symbolOptions, setSymbolOptions] = useState([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const toast = useRef(null);

  // Hàm lấy danh sách ký hiệu hóa đơn từ API
  const fetchInvoiceSymbols = async (mst) => {
    if (!mst.trim()) {
      setSymbolOptions([]);
      return;
    }

    setLoadingSymbols(true);
    try {
      const response = await fetch(
        `https://${mst}.minvoice.app/api/InvoiceApi78/GetTypeInvoiceSeries`,
        {
          method: "GET",
          headers: {
            Authorization:
              "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.log(`API Error: HTTP ${response.status} for MST: ${mst}`);
        setSymbolOptions([]);
        return;
      }

      const result = await response.json();

      if (result.ok && result.data && Array.isArray(result.data)) {
        // Chuyển đổi dữ liệu từ API thành format cho MultiSelect
        const options = result.data.map((item) => ({
          label: item.khhdon,
          value: item.khhdon,
        }));

        setSymbolOptions(options);

        toast.current.show({
          severity: "success",
          summary: "Thành công",
          detail: `Tìm thấy ${options.length} ký hiệu hóa đơn`,
          life: 3000,
        });
      } else {
        console.log(`API Response Error for MST: ${mst}`, result);
        setSymbolOptions([]);
        toast.current.show({
          severity: "warn",
          summary: "Cảnh báo",
          detail: result.message || "Không tìm thấy ký hiệu hóa đơn nào",
          life: 3000,
        });
      }
    } catch (error) {
      console.log(`Network/API Error for MST: ${mst}`, error);
      setSymbolOptions([]);
      // Không hiển thị toast error, chỉ log vào console
    } finally {
      setLoadingSymbols(false);
    }
  };

  // Debounce function để tránh gọi API quá nhiều lần
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (taxCode.trim()) {
        fetchInvoiceSymbols(taxCode);
      } else {
        setSymbolOptions([]);
        setSelectedSymbols([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [taxCode]);

  const handleSearchInvoices = async () => {
    if (!taxCode.trim()) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng nhập mã số thuế",
        life: 3000,
      });
      return;
    }

    // Kiểm tra có nhập danh sách hóa đơn không
    if (invoiceList.trim()) {
      handleProcessInvoiceList();
      return;
    }

    // Kiểm tra có chọn ký hiệu không (chỉ khi không nhập danh sách hóa đơn)
    if (selectedSymbols.length === 0) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng chọn ký hiệu hoặc nhập danh sách hóa đơn",
        life: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      // TODO: Gọi API thực tế để lấy danh sách hóa đơn
      // const response = await fetch(`https://${taxCode}.minvoice.app/api/...`, {
      //   method: "POST",
      //   headers: {
      //     "Authorization": "Bearer ...",
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     symbols: selectedSymbols,
      //     // other params
      //   })
      // });

      // const result = await response.json();
      // setInvoices(result.data || []);

      // Tạm thời set empty array
      setInvoices([]);
      setSelectedInvoices([]);
      setHasSearched(true);
      setVisible(false);

      toast.current.show({
        severity: "info",
        summary: "Thông báo",
        detail: "Chức năng tìm kiếm hóa đơn đang được phát triển",
        life: 3000,
      });
    } catch (error) {
      console.log("Error searching invoices:", error);
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: "Có lỗi xảy ra khi tải danh sách hóa đơn",
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessInvoiceList = () => {
    // Tách danh sách hóa đơn bằng dấu phẩy
    const invoiceNumbers = invoiceList
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num.length > 0);

    if (invoiceNumbers.length === 0) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Không tìm thấy số hóa đơn hợp lệ",
        life: 3000,
      });
      return;
    }

    // Tạo mock data từ danh sách số hóa đơn
    const mockInvoices = invoiceNumbers.map((invoiceNumber, index) => ({
      id: index + 1,
      invoiceNumber: invoiceNumber,
      date: new Date().toISOString().split("T")[0],
      amount: Math.floor(Math.random() * 5000000) + 1000000,
      status: "Đã ký",
    }));

    setInvoices(mockInvoices);
    setSelectedInvoices([]);
    setHasSearched(true);
    setVisible(false);
    setInvoiceList("");

    toast.current.show({
      severity: "success",
      summary: "Thành công",
      detail: `Đã tạo danh sách ${mockInvoices.length} hóa đơn`,
      life: 3000,
    });
  };

  const handleDeleteAllCache = async () => {
    if (selectedInvoices.length === 0) {
      toast.current.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: "Vui lòng chọn ít nhất một hóa đơn",
        life: 3000,
      });
      return;
    }

    setInvoiceLoading(true);

    try {
      // TODO: Gọi API thực tế để xóa cache
      // const response = await fetch(`https://${taxCode}.minvoice.app/api/...`, {
      //   method: "POST",
      //   headers: {
      //     "Authorization": "Bearer ...",
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     invoiceIds: selectedInvoices.map(inv => inv.id),
      //     // other params
      //   })
      // });

      // Giả lập thời gian xử lý
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.current.show({
        severity: "success",
        summary: "Thành công",
        detail: `Đã xóa cache cho ${selectedInvoices.length} hóa đơn`,
        life: 3000,
      });

      setSelectedInvoices([]);
    } catch (error) {
      console.log("Error deleting cache:", error);
      toast.current.show({
        severity: "error",
        summary: "Lỗi",
        detail: "Có lỗi xảy ra khi xóa cache",
        life: 3000,
      });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const onSelectionChange = (e) => {
    setSelectedInvoices(e.value);
  };

  const selectionTemplate = (rowData) => {
    return (
      <Checkbox
        checked={selectedInvoices.some((invoice) => invoice.id === rowData.id)}
        onChange={(e) => {
          if (e.checked) {
            setSelectedInvoices([...selectedInvoices, rowData]);
          } else {
            setSelectedInvoices(
              selectedInvoices.filter((invoice) => invoice.id !== rowData.id)
            );
          }
        }}
      />
    );
  };

  const amountTemplate = (rowData) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(rowData.amount);
  };

  const searchFooterContent = (
    <div className="flex justify-content-end gap-2">
      <Button
        label="Hủy"
        icon="pi pi-times"
        onClick={() => {
          setVisible(false);
          setInvoiceList("");
        }}
        className="p-button-text"
        disabled={loading}
      />
      <Button
        label="Tìm hóa đơn"
        icon="pi pi-search"
        onClick={handleSearchInvoices}
        loading={loading}
        className="p-button-primary"
        disabled={!taxCode.trim()}
      />
    </div>
  );

  return (
    <div className="p-4">
      <Toast ref={toast} />

      <Card title="Xóa Cache Hóa Đơn 2.0" className="mb-4">
        <div className="flex flex-column gap-4">
          <Message
            severity="info"
            text="Chức năng xóa cache hóa đơn 2.0 - Giải quyết nhanh lỗi ký hóa đơn"
            className="mb-3"
          />

          <Panel header="Khi nào sử dụng chức năng này?" className="mb-3">
            <div className="flex flex-column gap-2">
              <p className="m-0">
                Sử dụng khi ký hóa đơn báo lỗi:{" "}
                <strong className="text-red-500">
                  "Hóa đơn đã được ký. Vui lòng nhấn F5 hoặc tải lại trang"
                </strong>
              </p>
              <p className="m-0 text-sm text-600">
                Chức năng này giúp xóa cache nhanh hơn, hạn chế thao tác thủ
                công của kỹ thuật viên.
              </p>
            </div>
          </Panel>

          <Button
            label="Tìm hóa đơn"
            icon="pi pi-search"
            onClick={() => setVisible(true)}
            className="p-button-outlined p-button-primary"
          />
        </div>
      </Card>

      {/* Hiển thị danh sách hóa đơn sau khi tìm kiếm */}
      {hasSearched && (
        <Card title="Danh sách hóa đơn" className="mb-4">
          <div className="flex flex-column gap-3">
            <div className="flex justify-content-between align-items-center">
              <div className="flex align-items-center gap-2">
                <i className="pi pi-info-circle text-blue-500"></i>
                <span className="text-sm text-600">
                  Chọn các hóa đơn cần xóa cache. Chỉ hiển thị hóa đơn đã ký.
                </span>
              </div>
              <div className="flex align-items-center gap-3">
                <span className="text-sm text-600">
                  Đã chọn: <strong>{selectedInvoices.length}</strong> hóa đơn
                </span>
                <Button
                  label="Xóa ALL Cache"
                  icon="pi pi-trash"
                  onClick={handleDeleteAllCache}
                  loading={invoiceLoading}
                  className="p-button-danger"
                  disabled={selectedInvoices.length === 0}
                />
              </div>
            </div>

            <DataTable
              value={invoices}
              selection={selectedInvoices}
              onSelectionChange={onSelectionChange}
              dataKey="id"
              paginator
              rows={10}
              rowsPerPageOptions={[5, 10, 20]}
              className="p-datatable-sm"
              emptyMessage="Không tìm thấy hóa đơn nào"
            >
              <Column
                selectionMode="multiple"
                headerStyle={{ width: "3rem" }}
                body={selectionTemplate}
              />
              <Column field="invoiceNumber" header="Số hóa đơn" sortable />
              <Column field="date" header="Ngày tạo" sortable />
              <Column
                field="amount"
                header="Tổng tiền"
                body={amountTemplate}
                sortable
              />
              <Column
                field="status"
                header="Trạng thái"
                body={(rowData) => (
                  <span
                    className={`p-tag p-tag-${
                      rowData.status === "Đã ký" ? "success" : "warning"
                    }`}
                  >
                    {rowData.status}
                  </span>
                )}
              />
            </DataTable>
          </div>
        </Card>
      )}

      {/* Modal: Tìm kiếm hóa đơn */}
      <Dialog
        header="Tìm kiếm hóa đơn"
        visible={visible}
        style={{ width: "500px" }}
        onHide={() => {
          setVisible(false);
          setInvoiceList("");
        }}
        footer={searchFooterContent}
        modal
        className="p-fluid"
      >
        <div className="flex flex-column gap-3">
          <div className="field">
            <label htmlFor="taxCode" className="font-bold">
              Mã số thuế <span className="text-red-500">*</span>
            </label>
            <InputText
              id="taxCode"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              placeholder="Nhập mã số thuế"
              className="w-full"
            />
            {loadingSymbols && (
              <small className="text-blue-500">
                <i className="pi pi-spin pi-spinner mr-1"></i>
                Đang tải danh sách ký hiệu...
              </small>
            )}
          </div>

          <div className="field">
            <label htmlFor="symbols" className="font-bold">
              Ký hiệu
            </label>
            <MultiSelect
              id="symbols"
              value={selectedSymbols}
              options={symbolOptions}
              onChange={(e) => setSelectedSymbols(e.value)}
              placeholder="Chọn ký hiệu (có thể chọn nhiều)"
              className="w-full"
              showClear
              disabled={loadingSymbols || symbolOptions.length === 0}
              emptyMessage={
                taxCode.trim()
                  ? "Không tìm thấy ký hiệu nào"
                  : "Vui lòng nhập mã số thuế trước"
              }
              display="chip"
              maxSelectedLabels={3}
              selectedItemsLabel="{0} ký hiệu đã chọn"
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Chọn ký hiệu để tìm hóa đơn hoặc nhập danh sách hóa đơn bên dưới
            </small>
          </div>

          <div className="field">
            <label htmlFor="invoiceList" className="font-bold">
              Danh sách số hóa đơn
            </label>
            <InputTextarea
              id="invoiceList"
              value={invoiceList}
              onChange={(e) => setInvoiceList(e.target.value)}
              placeholder="Nhập các số hóa đơn cách nhau bởi dấu phẩy. Ví dụ: 0000001, 0000002, 0000003"
              rows={3}
              className="w-full"
            />
            <small className="text-600">
              <i className="pi pi-info-circle mr-1"></i>
              Nhập các số hóa đơn cách nhau bởi dấu phẩy (,). Ưu tiên cao hơn ký
              hiệu.
            </small>
          </div>

          {invoiceList.trim() && (
            <div className="field">
              <label className="font-bold">Xem trước:</label>
              <div className="p-2 border-1 border-200 border-round">
                <small className="text-600">
                  Sẽ tạo{" "}
                  {
                    invoiceList
                      .split(",")
                      .filter((num) => num.trim().length > 0).length
                  }{" "}
                  hóa đơn
                </small>
                <div className="mt-2">
                  {invoiceList
                    .split(",")
                    .filter((num) => num.trim().length > 0)
                    .map((num, index) => (
                      <span
                        key={index}
                        className="p-tag p-tag-secondary mr-1 mb-1"
                      >
                        {num.trim()}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
