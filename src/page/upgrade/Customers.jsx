import React, { useState, useRef } from "react";
import { Steps } from "primereact/steps";
import { Button } from "primereact/button";

import getDMKH from "../../Utils/GetDMKH.js";
import "../dashboard.scss";

import { Toast } from "primereact/toast";
import {
  mapCustomerDataAsync,
  exportToExcel,
  uploadExcelToServer as uploadExcelToServerDMKH,
} from "../../Utils/MappingDMKH.js";
import {
  mapProductDataAsync,
  exportToExcel as exportToExcelHH,
  uploadExcelToServer as uploadExcelToServerDMHH,
  setUploadConfig as setUploadConfigHH,
} from "../../Utils/MappingDMHH.js";
import uploadExcelFile from "../../Utils/UploadExcel.js";

import { mapCustomerData, exportToExcelAuto } from "../../Utils/AutoMapping.js";
import getDMHH from "../../Utils/GetDMHH.js";
import { useSelector } from "react-redux";

export default function Customers() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [customerRaws, setCustomerRaws] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHH, setLoadingHH] = useState(false);
  const [loadingUploadHH, setLoadingUploadHH] = useState(false);
  const [countError, setCountError] = useState(0);
  const [countSuccess, setCountSuccess] = useState(0);
  const toast = useRef(null);

  const show = () => {
    toast.current.show({
      summary: "Lỗi",
      detail: errorMessage,
    });
  };

  const taxCode = useSelector((state) => state.taxCode.value);
  const fetchDataDMKH = async () => {
    console.log(taxCode);
    setErrorMessage("");
    setLoading(true);
    try {
      console.log("📌 Đang lấy dữ liệu khách hàng...");
      const listDMKH = await getDMKH(taxCode);

      if (listDMKH.length > 0) {
        console.log("✅ Lấy dữ liệu thành công:", listDMKH);
        setCustomerRaws(listDMKH); // Cập nhật state nhưng chưa dùng ngay!

        const mappedData = await mapCustomerDataAsync(listDMKH);
        setCustomerRaws(mappedData); // State vẫn chưa cập nhật ngay lập tức!
        setActiveIndex(1);
        
        // Tự động upload lên 2.0 (không tải file về máy)
        console.log("📤 Đang tự động upload Excel lên 2.0...");
        setLoading(true); // Giữ loading để hiển thị đang upload
        try {
          await uploadExcelToServerDMKH(taxCode, (result) => {
            setLoading(false);
            if (result.success) {
              toast.current.show({
                severity: "success",
                summary: "Thành công",
                detail: result.message || "Đã upload Excel thành công!",
              });
              setActiveIndex(3);
            } else {
              toast.current.show({
                severity: "error",
                summary: "Lỗi",
                detail: result.message || "Upload thất bại!",
              });
              setActiveIndex(2);
            }
          });
        } catch (error) {
          setLoading(false);
          console.error("❌ Lỗi khi upload:", error);
          toast.current.show({
            severity: "error",
            summary: "Lỗi",
            detail: error.message || "Có lỗi xảy ra khi upload!",
          });
          setActiveIndex(2);
        }
      } else {
        console.warn("⚠️ Không có dữ liệu khách hàng.");
        setErrorMessage("Không có dữ liệu để tải lên.");
      }
    } catch (error) {
      console.error("❌ Lỗi khi lấy dữ liệu:", error);
      setErrorMessage("Lỗi khi lấy dữ liệu khách hàng.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDataDMHH = async () => {
    setErrorMessage("");
    setLoadingHH(true);
    try {
      console.log("📌 Đang lấy dữ liệu hàng hóa...");
      const listDMHH = await getDMHH(taxCode);

      if (listDMHH && listDMHH.length > 0) {
        console.log("✅ Lấy dữ liệu hàng hóa thành công:", listDMHH);
        setCustomerRaws(listDMHH); // Cập nhật state

        const mappedData = await mapProductDataAsync(listDMHH);
        setCustomerRaws(mappedData); // Cập nhật với dữ liệu đã mapping
        setActiveIndex(1);
        
        // Tự động upload lên 2.0 (không tải file về máy)
        console.log("📤 Đang tự động upload Excel lên 2.0...");
        setLoadingUploadHH(true);
        try {
          await uploadExcelToServerDMHH(taxCode, (result) => {
            setLoadingUploadHH(false);
            if (result.success) {
              toast.current.show({
                severity: "success",
                summary: "Thành công",
                detail: result.message || "Đã upload Excel thành công!",
              });
              setActiveIndex(3);
            } else {
              toast.current.show({
                severity: "error",
                summary: "Lỗi",
                detail: result.message || "Upload thất bại!",
              });
              setActiveIndex(2);
            }
          });
        } catch (error) {
          setLoadingUploadHH(false);
          console.error("❌ Lỗi khi upload:", error);
          toast.current.show({
            severity: "error",
            summary: "Lỗi",
            detail: error.message || "Có lỗi xảy ra khi upload!",
          });
          setActiveIndex(2);
        }
      } else {
        console.warn("⚠️ Không có dữ liệu hàng hóa.");
        setErrorMessage("Không có dữ liệu hàng hóa để tải lên.");
      }
    } catch (error) {
      console.error("❌ Lỗi khi lấy dữ liệu hàng hóa:", error);
      setErrorMessage(
        error.message || "Lỗi khi lấy dữ liệu hàng hóa. Vui lòng kiểm tra lại."
      );
    } finally {
      setLoadingHH(false);
    }
  };

  // 🆕 Hàm xử lý upload file Excel
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileUpload = async (event = null) => {
    console.log("📌 handleFileUpload() được gọi!", event);
    let file = null;
    setLoading(true);

    try {
      if (event) {
        console.log("📂 Upload thủ công");
        const fileInput = event.target;
        file = fileInput.files[0];
        if (!file) return;
      } else {
        console.log("⚡ Đang tạo file Excel...");

        if (!customerRaws || customerRaws.length === 0) {
          throw new Error("Không có dữ liệu khách hàng để xuất Excel!");
        }

        const mappedData = await mapCustomerData(customerRaws);
        console.log("✅ Dữ liệu đã mapping:", mappedData);

        const fileBlob = exportToExcelAuto(mappedData);
        console.log("✅ Đã tạo Blob Excel:", fileBlob);

        file = new File([fileBlob], "DanhSachKhachHang.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }

      console.log("📤 Đang upload file...", file);
      const importedData = await uploadExcelFile(file, "1101884452");
      console.log("✅ Upload thành công:", importedData);

      setCustomerRaws(importedData);
      setErrorMessage("");
    } catch (error) {
      console.error("❌ Lỗi khi tải file Excel:", error);
      setErrorMessage(error?.message || JSON.stringify(error));
    } finally {
      setLoading(false);
      if (event) event.target.value = "";
      setActiveIndex(3);
    }
  };

  const steps = [
    { label: "Lấy DM khách hàng" },
    { label: "Mapping data" },
    { label: "Thêm lên 2.0" },
    { label: "Hoàn tất" },
  ];
  const steps_HH = [
    { label: "Lấy DM Hàng hoá" },
    { label: "Mapping data" },
    { label: "Thêm lên 2.0" },
    { label: "Hoàn tất" },
  ];

  return (
    <div className="pt-[10px] w-full flex flex-col pl-[24px] gap-3 ">
      <div className="flex flex-row w-full">
        {" "}
        <div className="flex-1 flex h-full pr-12">
          <Button
            loading={loading}
            onClick={fetchDataDMKH}
            style={{ height: "40px", width: "230px" }}
            label="Đồng bộ khách hàng"
          />
        </div>
        <div
          className="w-full flex flex-col border-2 rounded-lg  p-6 shadow-lg "
          style={{
            boxShadow: loading
              ? "0px 4px 10px rgba(59, 130, 246, 0.5)"
              : "none",
          }}
        >
          <Steps
            model={steps}
            activeIndex={activeIndex}
            onSelect={(e) => setActiveIndex(e.index)}
            readOnly={true}
          />

          <div className="flex w-full gap-[1rem] mt-6">
            {/* Tổng số bản ghi */}
            <InfoCard title="Số lượng bản ghi" value={customerRaws?.length} />

            {/* Trạng thái Mapping */}
            <InfoCard
              title="Trạng thái"
              value={activeIndex >= 1 ? "Xong" : ""}
            />

            {/* Xuất & Upload Excel */}
            <div className="flex-1 border-2 border-dotted rounded-lg p-4">
              <InfoRow
                title="Tải file Excel"
                iconClass="fa-solid fa-file-excel text-green-600 cursor-pointer"
                onClick={exportToExcel}
              />

              {/* 🆕 Input hidden để chọn file */}
              <input
                type="file"
                accept=".xls, .xlsx"
                className="hidden"
                id="file-upload"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="file-upload"
                className="text-blue-600 text-[13px] cursor-pointer border-2 bg-gray p-1"
              >
                Chọn file
              </label>
            </div>

            {/* Trạng thái Hoàn tất */}
            <div className="flex-1 border-2 border-dotted rounded-lg p-4">
              {" "}
              <div
                className=""
                title="Kết quả"
                value={errorMessage.length > 0 ? "Thất bại" : "Thành công"}
              >
                <div className="card flex justify-content-center">
                  <Toast ref={toast} />
                  {errorMessage.length > 0 ? (
                    <Button onClick={show} label="Thất bại" />
                  ) : errorMessage.length === 0 ? (
                    ""
                  ) : !errorMessage ? (
                    "Thành công"
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-row w-full">
        {" "}
        <div className="flex-1 flex h-full pr-12">
          <Button
            loading={loadingHH}
            onClick={fetchDataDMHH}
            style={{ height: "40px", width: "230px" }}
            label="Đồng bộ hàng hoá"
          />
        </div>
        <div
          className="w-full flex flex-col border-2 rounded-lg p-6"
          style={{
            boxShadow: loadingHH
              ? "0px 4px 10px rgba(59, 130, 246, 0.5)"
              : "none",
          }}
        >
          <Steps
            model={steps_HH}
            activeIndex={activeIndex}
            onSelect={(e) => setActiveIndex(e.index)}
            readOnly={false}
          />

          <div className="flex w-full gap-[1rem] mt-6">
            {/* Tổng số bản ghi */}
            <InfoCard title="Số lượng bản ghi" value={customerRaws?.length} />

            {/* Trạng thái Mapping */}
            <InfoCard
              title="Trạng thái"
              value={activeIndex >= 1 ? "Xong" : ""}
            />

            {/* Xuất & Upload Excel - Hàng hóa */}
            <div className="flex-1 border-2 border-dotted rounded-lg p-4">
              <InfoRow
                title="Tải file Excel"
                iconClass="fa-solid fa-file-excel text-green-600 cursor-pointer"
                onClick={async () => {
                  if (!taxCode) {
                    toast.current.show({
                      severity: "warn",
                      summary: "Cảnh báo",
                      detail: "Vui lòng nhập mã số thuế.",
                    });
                    return;
                  }
                  
                  setLoadingUploadHH(true);
                  try {
                    // Tự động export và upload (browser sẽ tự động gửi cookies theo domain)
                    await exportToExcelHH(taxCode, (result) => {
                      setLoadingUploadHH(false);
                      if (result.success) {
                        toast.current.show({
                          severity: "success",
                          summary: "Thành công",
                          detail: result.message || "Đã export và upload Excel thành công!",
                        });
                        setActiveIndex(3);
                      } else {
                        toast.current.show({
                          severity: "error",
                          summary: "Lỗi",
                          detail: result.message || "Upload thất bại!",
                        });
                      }
                    });
                  } catch (error) {
                    setLoadingUploadHH(false);
                    toast.current.show({
                      severity: "error",
                      summary: "Lỗi",
                      detail: error.message || "Có lỗi xảy ra!",
                    });
                  }
                }}
              />

              {/* 🆕 Input hidden để chọn file */}
              <input
                type="file"
                accept=".xls, .xlsx"
                className="hidden"
                id="file-upload-hh"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="file-upload-hh"
                className="text-blue-600 text-[13px] cursor-pointer border-2 bg-gray p-1"
              >
                Chọn file
              </label>
            </div>

            {/* Trạng thái Hoàn tất */}
            <div className="flex-1 border-2 border-dotted rounded-lg p-4">
              {" "}
              <div
                className=""
                title="Kết quả"
                value={errorMessage.length > 0 ? "Thất bại" : "Thành công"}
              >
                <div className="card flex justify-content-center">
                  <Toast ref={toast} />
                  {errorMessage.length > 0 ? (
                    <Button onClick={show} label="Thất bại" />
                  ) : errorMessage.length === 0 ? (
                    ""
                  ) : !errorMessage ? (
                    "Thành công"
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component hiển thị thông tin chung
const InfoCard = ({ title, value }) => (
  <div className="flex-1 border-2 border-dotted rounded-lg p-4">
    <p>{title}:</p>
    <p className="text-primary font-bold pl-2">{value}</p>
  </div>
);

// Component hiển thị hàng có icon
const InfoRow = ({ title, iconClass, onClick }) => (
  <div className="flex flex-row items-center justify-between">
    <p>{title}:</p>
    <span className={iconClass} onClick={onClick} />
  </div>
);
