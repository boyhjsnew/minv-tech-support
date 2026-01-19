import React, { useState, useRef } from "react";
import { Steps } from "primereact/steps";

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
        try {
          await uploadExcelToServerDMHH(taxCode, (result) => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-5">
      {/* Header Section */}
      <div className="text-center mb-2 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl shadow-xl mb-3 transform hover:scale-105 transition-transform duration-300">
          <i className="fa-solid fa-sync-alt text-white text-xl animate-spin-slow"></i>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
          Đồng bộ dữ liệu
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Đồng bộ khách hàng và hàng hóa từ hệ thống cũ lên hệ thống mới
        </p>
      </div>

      {/* Khách hàng */}
      <div className="grid lg:grid-cols-[260px,1fr] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <button
            onClick={fetchDataDMKH}
            disabled={loading}
            className={`
              group relative w-full h-12 rounded-xl font-semibold text-white
              bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
              shadow-lg hover:shadow-xl transform transition-all duration-300
              disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
              ${!loading ? 'hover:scale-105 active:scale-95' : ''}
              overflow-hidden
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Đang xử lý...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <i className="fa-solid fa-users text-lg"></i>
                <span>Đồng bộ khách hàng</span>
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          </button>
        </div>
        <div
          className={`
            w-full flex flex-col rounded-2xl p-4 sm:p-5 shadow-xl bg-white
            border border-gray-100 transition-all duration-500
            ${loading ? 'ring-4 ring-blue-200 shadow-2xl shadow-blue-200/50' : ''}
          `}
        >
          {/* Header Card - Horizontal Layout */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-[250px]">
              <h3 className="text-sm sm:text-base font-bold text-gray-800">Đồng bộ khách hàng</h3>
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : activeIndex >= 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="text-xs text-gray-500">
                {activeIndex >= 0 ? steps[activeIndex]?.label : "Chưa bắt đầu"}
              </span>
            </div>
            {taxCode && (
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                MST: {taxCode}
              </span>
            )}
          </div>

          <Steps
            model={steps}
            activeIndex={activeIndex}
            onSelect={(e) => setActiveIndex(e.index)}
            readOnly={true}
            className="mb-3"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard 
              title="Số lượng bản ghi" 
              value={customerRaws?.length || 0}
              icon="fa-solid fa-database"
              color="blue"
            />

            <InfoCard
              title="Trạng thái"
              value={activeIndex >= 1 ? "Hoàn thành" : activeIndex >= 0 ? "Đang xử lý" : "Chưa bắt đầu"}
              icon="fa-solid fa-check-circle"
              color={activeIndex >= 1 ? "green" : activeIndex >= 0 ? "yellow" : "gray"}
            />

            <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-dashed border-green-200 hover:border-green-300 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Tải file Excel</span>
                <i 
                  className="fa-solid fa-file-excel text-green-600 text-xl cursor-pointer hover:scale-110 transition-transform duration-200" 
                  onClick={exportToExcel}
                  title="Tải file Excel"
                ></i>
              </div>
              <input
                type="file"
                accept=".xls, .xlsx"
                className="hidden"
                id="file-upload"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-3 py-2 bg-white text-blue-600 text-sm font-medium cursor-pointer border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
              >
                <i className="fa-solid fa-upload"></i>
                <span>Chọn file</span>
              </label>
            </div>

            <div className="flex-1 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-dashed border-purple-200">
              <div className="card flex justify-content-center">
                <Toast ref={toast} />
                {errorMessage.length > 0 && (
                  <button
                    onClick={show}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                    Xem lỗi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hàng hóa */}
      <div className="grid lg:grid-cols-[260px,1fr] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <button
            onClick={fetchDataDMHH}
            disabled={loadingHH}
            className={`
              group relative w-full h-12 rounded-xl font-semibold text-white
              bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600
              shadow-lg hover:shadow-xl transform transition-all duration-300
              disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
              ${!loadingHH ? 'hover:scale-105 active:scale-95' : ''}
              overflow-hidden
            `}
          >
            {loadingHH ? (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Đang xử lý...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <i className="fa-solid fa-boxes-stacked text-lg"></i>
                <span>Đồng bộ hàng hoá</span>
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          </button>
        </div>
        <div
          className={`
            w-full flex flex-col rounded-2xl p-4 sm:p-5 shadow-xl bg-white
            border border-gray-100 transition-all duration-500
            ${loadingHH ? 'ring-4 ring-indigo-200 shadow-2xl shadow-indigo-200/50' : ''}
          `}
        >
          {/* Header Card - Horizontal Layout */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-[250px]">
              <h3 className="text-sm sm:text-base font-bold text-gray-800">Đồng bộ hàng hoá</h3>
              <span className={`w-2 h-2 rounded-full ${loadingHH ? 'bg-indigo-500 animate-pulse' : activeIndex >= 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className="text-xs text-gray-500">
                {activeIndex >= 0 ? steps_HH[activeIndex]?.label : "Chưa bắt đầu"}
              </span>
            </div>
            {taxCode && (
              <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                MST: {taxCode}
              </span>
            )}
          </div>

          <Steps
            model={steps_HH}
            activeIndex={activeIndex}
            onSelect={(e) => setActiveIndex(e.index)}
            readOnly={false}
            className="mb-3"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard 
              title="Số lượng bản ghi" 
              value={customerRaws?.length || 0}
              icon="fa-solid fa-database"
              color="indigo"
            />

            <InfoCard
              title="Trạng thái"
              value={activeIndex >= 1 ? "Hoàn thành" : activeIndex >= 0 ? "Đang xử lý" : "Chưa bắt đầu"}
              icon="fa-solid fa-check-circle"
              color={activeIndex >= 1 ? "green" : activeIndex >= 0 ? "yellow" : "gray"}
            />

            <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-dashed border-green-200 hover:border-green-300 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Tải file Excel</span>
                <i 
                  className="fa-solid fa-file-excel text-green-600 text-xl cursor-pointer hover:scale-110 transition-transform duration-200" 
                  onClick={async () => {
                    if (!taxCode) {
                      toast.current.show({
                        severity: "warn",
                        summary: "Cảnh báo",
                        detail: "Vui lòng nhập mã số thuế.",
                      });
                      return;
                    }

                    try {
                      await exportToExcelHH(taxCode, (result) => {
                        if (result.success) {
                          toast.current.show({
                            severity: "success",
                            summary: "Thành công",
                            detail:
                              result.message ||
                              "Đã export và upload Excel thành công!",
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
                      toast.current.show({
                        severity: "error",
                        summary: "Lỗi",
                        detail: error.message || "Có lỗi xảy ra!",
                      });
                    }
                  }}
                  title="Tải file Excel"
                ></i>
              </div>
              <input
                type="file"
                accept=".xls, .xlsx"
                className="hidden"
                id="file-upload-hh"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="file-upload-hh"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 text-sm font-medium cursor-pointer border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
              >
                <i className="fa-solid fa-upload"></i>
                <span>Chọn file</span>
              </label>
            </div>

            <div className="flex-1 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-dashed border-purple-200">
              <div className="card flex justify-content-center">
                <Toast ref={toast} />
                {errorMessage.length > 0 && (
                  <button
                    onClick={show}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                    Xem lỗi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component hiển thị thông tin chung
const InfoCard = ({ title, value, icon, color = "blue" }) => {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    indigo: "from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700",
    green: "from-green-50 to-green-100 border-green-200 text-green-700",
    yellow: "from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-700",
    gray: "from-gray-50 to-gray-100 border-gray-200 text-gray-700",
  };

  const iconColors = {
    blue: "text-blue-600",
    indigo: "text-indigo-600",
    green: "text-green-600",
    yellow: "text-yellow-600",
    gray: "text-gray-600",
  };

  return (
    <div className={`
      flex-1 bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4
      border-2 border-dashed hover:border-solid transition-all duration-300
      hover:shadow-lg transform hover:scale-[1.02]
    `}>
      <div className="flex items-center gap-3 mb-2">
        {icon && (
          <div className={`w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center ${iconColors[color]}`}>
            <i className={`${icon} text-sm`}></i>
          </div>
        )}
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</p>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color].split(' ')[2]}`}>
        {value || 0}
      </p>
    </div>
  );
};
