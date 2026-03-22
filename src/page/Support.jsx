import React, { useState, useEffect, useMemo } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastNotify from "../components/ToastNotify";
import { styleSuccess, styleError } from "../components/ToastNotifyStyle";
import axios from "axios";
import GetInvoiceFiles from "./GetInvoiceFiles";
import { useSearchParams } from "react-router-dom";
import GetTokenCRM from "../Utils/GetTokenCRM";
import ResetPasswordNewApp from "../Utils/ResetPasswordNewApp";
import { Dropdown } from "primereact/dropdown";

// Ẩn chức năng xoá chứng từ TNCN (đặt true để hiện lại)
const SHOW_TNCN_DELETE = false;

// Header và auth cho API Save (Cập nhật ngày HĐ hàng loạt) - theo curl
const SAVE_API_AUTH = "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=";
const SAVE_API_HEADERS = {
  Accept: "*/*",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "Content-Type": "application/json",
  Origin: "https://msupport.minvoice.com.vn",
  Pragma: "no-cache",
  Referer: "https://msupport.minvoice.com.vn/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  Authorization: SAVE_API_AUTH,
};

/** Đảm bảo giá trị luôn là mảng (JsonArray). */
function ensureJsonArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && !Array.isArray(value)) return Object.values(value);
  return [];
}

/**
 * Cấu trúc details đúng theo API: details = [ { data: [ dòng 1, dòng 2, ... ] } ].
 * GetInfoInvoice có thể trả về details là object { data: [...] } hoặc mảng tab [ { data: [...] } ].
 */
function buildDetailsForSave(invoice) {
  const detailsRaw = invoice.details;
  if (detailsRaw == null) return [{ data: [] }];

  // Trường hợp API trả về details = { data: [ dòng 1, dòng 2, ... ] }
  if (typeof detailsRaw === "object" && !Array.isArray(detailsRaw) && "data" in detailsRaw) {
    const dataArray = ensureJsonArray(detailsRaw.data);
    return [{ data: dataArray }];
  }

  // Trường hợp details là mảng tab [ { data: [...] }, ... ]
  const detailsArray = ensureJsonArray(detailsRaw);
  return detailsArray.map((tab) => {
    const dataRaw = tab != null && typeof tab === "object" ? tab.data : undefined;
    const dataArray = ensureJsonArray(dataRaw);
    return { data: dataArray };
  });
}

/**
 * Map từ GetInfoInvoice sang 1 phần tử cho API Save.
 * Cấu trúc details giống mẫu: [ { data: [ dòng 1, dòng 2, ... ] } ]. Chỉ đổi ngày.
 */
function mapInvoiceToSaveData(invoice, newDateYyyyMmDd) {
  const issued = (newDateYyyyMmDd || "").trim() || invoice.inv_invoiceIssuedDate || "";
  const details = buildDetailsForSave(invoice);

  return {
    ...invoice,
    inv_invoiceIssuedDate: issued,
    details,
  };
}

const Support = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("create-serial");
  const [khhdonList, setKhhdonList] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);

  // States for "Cập nhật HĐ lỗi" tab
  const [taxCode, setTaxCode] = useState("");
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [tuSo, setTuSo] = useState("");
  const [denSo, setDenSo] = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceList, setInvoiceList] = useState([]);
  const [token, setToken] = useState("");
  const [showTokenTooltip, setShowTokenTooltip] = useState(false);

  // States for "Cập nhật ngày HĐ hàng loạt" tab
  const [bulkTaxCode, setBulkTaxCode] = useState("");
  const [bulkFromNumber, setBulkFromNumber] = useState("");
  const [bulkToNumber, setBulkToNumber] = useState("");
  const [bulkNewDate, setBulkNewDate] = useState("");

  // States for "Xoá chứng từ TNCN" tab (defaults theo curl mẫu bạn gửi)
  const [tncnTaxCode, setTncnTaxCode] = useState("0313364566");
  const [tncnVoucherSymbolId, setTncnVoucherSymbolId] = useState(
    "3a1cf7e4-9de3-e97e-8b9f-ba83282dea11"
  );
  const [tncnBearerToken, setTncnBearerToken] = useState(
    "eyJhbGciOiJSUzI1NiIsImtpZCI6IkRGREQyM0Y5NTM3RTQyQ0FCNUU5NDM1MDEzRTJBMzBFMzRCMjVCNEIiLCJ4NXQiOiIzOTBqLVZOLVFzcTE2VU5RRS1LakRqU3lXMHMiLCJ0eXAiOiJhdCtqd3QifQ.eyJpc3MiOiJodHRwczovL2xvY2FsaG9zdDo0NDM1My8iLCJleHAiOjE3NzI0NDc1NTksImlhdCI6MTc3MjQxODc1OSwiYXVkIjoiTWludm9pY2VBcGkiLCJzY29wZSI6Ik1pbnZvaWNlQXBpIiwianRpIjoiMzM0MzMxZjctNGQ3ZS00NDQzLWE3OTMtZDllYTI5ZTMwZWNkIiwic3ViIjoiM2ExY2Y3ZTQtOWMyYi02MTkwLWExYjUtYmQ5OWI5NDM2OTFmIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiQWRtaW4iLCJlbWFpbCI6ImhpZW50dEBtaW52b2ljZS52biIsInJvbGUiOiJRdeG6o24gdHLhu4siLCJ0ZW5hbnRpZCI6IjNhMWNmN2U0LTlhZTktOGY2OS1mMjAxLTc1MzM0OGFhNDBiOCIsImdpdmVuX25hbWUiOiIwMzEzMzY0NTY2IiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjoiRmFsc2UiLCJlbWFpbF92ZXJpZmllZCI6IkZhbHNlIiwidW5pcXVlX25hbWUiOiJBZG1pbiIsIm9pX3Byc3QiOiJNaW52b2ljZUFwaV9BcHAiLCJjbGllbnRfaWQiOiJNaW52b2ljZUFwaV9BcHAiLCJvaV90a25faWQiOiIzYTFmYmU5MC1kNGY2LThmYzMtNGFmYS05ZDBkMTlhZTZlM2EifQ.mSHohXJLYmDk7zMCkZeStaCMftsq41LrEd53pwyJ03zWBaoXllNvfG2isX9H-TddauOIwPrH-c0BvjuIp6B9M0tFRzMiLHb1MPV5nGmbll-T5RUnczNYqN4hAUnf2Yvsue7aplUqyivqwIo4zQUNL0Ls1AsKl5_VAtznQGYT_hOCE9E8OcsJSOJJZoEF43v1pObH6M_iOxFJHsg-MeXTzd8yiNU0sEozx98w0K6kloJY9eeLBvzDRtKE9FO9myAFEMOONlVxwnumbB7L60aXNmNGS6FRyZPtzIcN9ESh_QcKlwHXjHf8l9ZsLe8bqn1C-IuHmnGowj8dJ_bOsd55uw"
  );
  const [tncnRequestVerificationToken, setTncnRequestVerificationToken] =
    useState(
      "CfDJ8EiX1iYPse5KlIhd39kSFE31NCzbrYB2_yZDifWvjJv37XkUaYHyCL_ULlLAA140b9dG0qmMgLV5CR_Fr2_PJ--q4pTJYiXRVhF-BHd8_ciZO1ofd3Jp1UIXMjx9UqU0lU3Lru7KnF3JPHFRA_08hrtSgSfk8TMLLwxDlr45DiORh-_JnQ63zsRaSNBGb_9Tjg"
    );
  const [tncnLoading, setTncnLoading] = useState(false);
  const [tncnLog, setTncnLog] = useState({ totalFetched: 0, deleteSuccess: 0, deleteFail: 0 });

  // States for "Kiểm tra đang gửi hàng loạt" tab
  const [checkTaxCode, setCheckTaxCode] = useState("");
  const [checkRegisterInvoiceId, setCheckRegisterInvoiceId] = useState("");
  const [checkRegisterList, setCheckRegisterList] = useState([]);
  const [loadingCheckRegisterList, setLoadingCheckRegisterList] = useState(false);
  const [checkAccount20, setCheckAccount20] = useState(null);
  const [checkInvoiceList, setCheckInvoiceList] = useState([]);
  const [checkResults, setCheckResults] = useState([]);
  const [loadingCheckAccount, setLoadingCheckAccount] = useState(false);
  const [loadingCheckList, setLoadingCheckList] = useState(false);
  const [loadingCheckBatch, setLoadingCheckBatch] = useState(false);

  const domain = "http://bienlai70.vpdkddtphcm.com.vn";

  /** Options cho PrimeReact Dropdown (ký hiệu / tờ khai đăng ký) — có filter sẵn trên dropdown */
  const checkRegisterDropdownOptions = useMemo(
    () =>
      checkRegisterList.map((reg) => ({
        label: reg.name || String(reg.id),
        value: reg.id,
      })),
    [checkRegisterList]
  );

  // Các trường cố định
  const fixedData = {
    lhdon: "1",
    hthuc: "C",
    khdon: "T",
    mau_so: "CTT56",
    sdmau: 8,
    quanlymau68_id: "aae35b0a-714c-4660-bdff-76060801d38d",
    loai_doanh_nghiep: "",
  };

  useEffect(() => {
    document.title = "Cập nhật DB 2.0";
    // Đọc query parameter từ URL
    const tab = searchParams.get("tab");
    if (tab === "get-files") {
      setActiveTab("get-files");
    } else if (tab === "update-error") {
      setActiveTab("update-error");
    } else if (tab === "fill-gap") {
      setActiveTab("fill-gap");
    } else if (tab === "bulk-update-date") {
      setActiveTab("bulk-update-date");
    } else if (tab === "check-sending") {
      setActiveTab("check-sending");
    } else if (SHOW_TNCN_DELETE && tab === "delete-tncn") {
      setActiveTab("delete-tncn");
    }
  }, [searchParams]);

  // Tự động gọi API khi nhập mã số thuế (với debounce)
  useEffect(() => {
    // Chỉ gọi khi đang ở tab "update-error" hoặc \"Cập nhật ngày HĐ hàng loạt\" và có mã số thuế hợp lệ
    if (activeTab !== "update-error" && activeTab !== "bulk-update-date")
      return;
    
    const trimmedTaxCode = taxCode.trim();
    
    // Chỉ gọi khi mã số thuế có ít nhất 5 ký tự
    if (trimmedTaxCode.length < 5) {
      setSeriesList([]);
      setSelectedSeries("");
      return;
    }

    // Debounce: đợi 800ms sau khi người dùng ngừng gõ
    const timeoutId = setTimeout(() => {
      // Gọi API tự động (không hiển thị toast error nếu rỗng)
      handleGetSeries(true);
    }, 800);

    // Cleanup timeout nếu taxCode thay đổi trước khi timeout
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxCode, activeTab]);

  const createSerial = async (khhdon) => {
    const url = `${domain}/api/Serial/SerialSaveChange`;

    const requestData = {
      ...fixedData,
      khhdon: khhdon.trim(),
    };

    try {
      const response = await axios.post(url, requestData, {
        headers: {
          Accept: "*/*",
          "Accept-Language":
            "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
          Authorization: "Bear O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-type": "application/json",
          Origin: domain,
          Pragma: "no-cache",
          Referer: `${domain}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        },
        withCredentials: true,
      });

      return {
        success: true,
        khhdon,
        data: response.data,
        message: `Tạo thành công cho ${khhdon}`,
      };
    } catch (error) {
      return {
        success: false,
        khhdon,
        error: error.response?.data || error.message,
        message: `Lỗi khi tạo ${khhdon}: ${
          error.response?.data?.message || error.message
        }`,
      };
    }
  };

  // Helper function để retry API call (đặt ngoài để tránh linter warning)
  // Hàm lấy danh sách ký hiệu từ API
  const handleGetSeries = async (isAutoCall = false) => {
    if (!taxCode.trim()) {
      if (!isAutoCall) {
        toast.error(
          <ToastNotify status={1} message="Vui lòng nhập mã số thuế" />,
          { style: styleError }
        );
      }
      return;
    }

    setLoadingSeries(true);
    setSeriesList([]);
    setSelectedSeries("");

    // Kiểm tra nếu mã số thuế kết thúc bằng -998 thì dùng .site, ngược lại dùng .app
    const domain = taxCode.endsWith("-998") ? ".minvoice.site" : ".minvoice.app";
    const url = `https://${taxCode}${domain}/api/InvoiceApi78/GetTypeInvoiceSeries`;

    const headers = {
      Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.get(url, { headers });

      if (response?.data && response.data.code === "00" && response.data.data) {
        setSeriesList(response.data.data);
        if (response.data.data.length > 0) {
          toast.success(
            <ToastNotify
              status={0}
              message={`Tìm thấy ${response.data.data.length} ký hiệu`}
            />,
            { style: styleSuccess }
          );
        } else {
          toast.warning(
            <ToastNotify status={1} message="Không tìm thấy ký hiệu nào" />,
            { style: styleError }
          );
        }
      } else {
        throw new Error(
          response?.data?.message || "Không thể lấy danh sách ký hiệu"
        );
      }
    } catch (error) {
      console.error("Error fetching series:", error.message);
      if (error.response) {
        console.error("Response error:", error.response.data);
      }
      toast.error(
        <ToastNotify
          status={1}
          message={
            error.response?.data?.message ||
            error.message ||
            "Lỗi khi lấy danh sách ký hiệu"
          }
        />,
        { style: styleError }
      );
      setSeriesList([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  // Hàm cập nhật hóa đơn lỗi - lấy ID và cập nhật ngay
  const handleUpdateErrorInvoices = async () => {
    if (!taxCode.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập mã số thuế" />,
        { style: styleError }
      );
      return;
    }

    if (!selectedSeries) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng chọn ký hiệu" />,
        { style: styleError }
      );
      return;
    }

    if (!tuSo.trim() || !denSo.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập từ số và đến số" />,
        { style: styleError }
      );
      return;
    }

    if (!token.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập token" />,
        { style: styleError }
      );
      return;
    }

    const tuSoNum = parseInt(tuSo);
    const denSoNum = parseInt(denSo);

    if (isNaN(tuSoNum) || isNaN(denSoNum) || tuSoNum > denSoNum) {
      toast.error(
        <ToastNotify status={1} message="Số hóa đơn không hợp lệ. Từ số phải nhỏ hơn hoặc bằng đến số" />,
        { style: styleError }
      );
      return;
    }

    setLoadingInvoices(true);
    setInvoiceList([]);

    // Kiểm tra nếu mã số thuế kết thúc bằng -998 thì dùng .site, ngược lại dùng .app
    const domain = taxCode.endsWith("-998") ? ".minvoice.site" : ".minvoice.app";
    const baseUrl = `https://${taxCode}${domain}/api/InvoiceApi78/GetInfoInvoice`;

    const getInvoiceHeaders = {
      Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
      "Content-Type": "application/json",
    };

    const updateUrl = "https://n8n.minvoice.com.vn/webhook/login";
    const updateHeaders = {
      "Content-Type": "application/json",
      Accept: "*/*",
    };

    const results = [];
    const total = denSoNum - tuSoNum + 1;
    let successCount = 0;
    let updateSuccessCount = 0;
    let updateErrorCount = 0;

    try {
      // Lặp qua từng số hóa đơn từ tuSo đến denSo
      for (let number = tuSoNum; number <= denSoNum; number++) {
        const url = `${baseUrl}?number=${number}&seri=${selectedSeries}`;
        
        try {
          // Bước 1: Lấy thông tin hóa đơn
          const response = await axios.get(url, { headers: getInvoiceHeaders });
          
          if (response?.data && response.data.code === "00" && response.data.data) {
            const invoice = response.data.data;
            const tthai = invoice.tthai || "";
            
            // Chỉ xử lý hóa đơn có trạng thái "Chờ ký"
            if (tthai === "Chờ ký") {
              const invoiceId = invoice.inv_invoiceAuth_id || invoice.hoadon68_id;
              
              if (invoiceId) {
                // Bước 2: Cập nhật hóa đơn qua API n8n
                try {
                  const updateBody = {
                    token: token.trim(),
                    caseType: "UD04",
                    TaxCode: taxCode.trim(),
                    Id: invoiceId,
                  };

                  const updateResponse = await axios.post(updateUrl, updateBody, { headers: updateHeaders });

                  if (updateResponse?.data) {
                    results.push({
                      number: number,
                      seri: selectedSeries,
                      hoadon68_id: invoice.hoadon68_id,
                      inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
                      khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
                      shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
                      tthai: tthai,
                      status: "success",
                      updateStatus: "success",
                    });
                    updateSuccessCount++;
                  } else {
                    throw new Error("Không nhận được phản hồi từ server");
                  }
                } catch (updateError) {
                  results.push({
                    number: number,
                    seri: selectedSeries,
                    hoadon68_id: invoice.hoadon68_id,
                    inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
                    khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
                    shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
                    tthai: tthai,
                    status: "success",
                    updateStatus: "error",
                    updateError: updateError.response?.data?.message || updateError.message || "Lỗi khi cập nhật",
                  });
                  updateErrorCount++;
                }
              } else {
                results.push({
                  number: number,
                  seri: selectedSeries,
                  hoadon68_id: invoice.hoadon68_id,
                  inv_invoiceAuth_id: null,
                  khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
                  shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
                  tthai: tthai,
                  status: "success",
                  updateStatus: "error",
                  updateError: "Không tìm thấy ID hóa đơn",
                });
                updateErrorCount++;
              }
              successCount++;
            }
          }
        } catch (error) {
          // Lỗi khi lấy thông tin hóa đơn
          results.push({
            number: number,
            seri: selectedSeries,
            hoadon68_id: null,
            inv_invoiceAuth_id: null,
            khieu: selectedSeries,
            shdon: number,
            tthai: "Lỗi",
            status: "error",
            updateStatus: "error",
            updateError: error.response?.data?.message || error.message || "Lỗi khi lấy thông tin",
          });
        }

        // Thêm delay nhỏ giữa các request để tránh quá tải
        if (number < denSoNum) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      setInvoiceList(results);

      // Hiển thị thông báo kết quả
      if (successCount > 0) {
        if (updateSuccessCount > 0) {
          toast.success(
            <ToastNotify
              status={0}
              message={`Đã cập nhật thành công ${updateSuccessCount}/${total} hóa đơn trong khoảng ${tuSo} - ${denSo}`}
            />,
            { style: styleSuccess }
          );
        }
        if (updateErrorCount > 0) {
          toast.warning(
            <ToastNotify
              status={1}
              message={`Có ${updateErrorCount}/${total} hóa đơn cập nhật thất bại trong khoảng ${tuSo} - ${denSo}`}
            />,
            { style: styleError }
          );
        }
      } else {
        toast.warning(
          <ToastNotify status={1} message={`Không tìm thấy hóa đơn "Chờ ký" nào trong khoảng ${tuSo} - ${denSo} (${total} hóa đơn đã kiểm tra)`} />,
          { style: styleError }
        );
      }
    } catch (error) {
      console.error("Error updating invoices:", error);
      toast.error(
        <ToastNotify
          status={1}
          message={
            error.response?.data?.message ||
            error.message ||
            "Lỗi khi cập nhật hóa đơn"
          }
        />,
        { style: styleError }
      );
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleBulkUpdateInvoiceDates = (e) => {
    e.preventDefault();

    // Validate basic input
    if (!bulkTaxCode.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập mã số thuế" />,
        { style: styleError }
      );
      return;
    }
    if (!bulkFromNumber.trim() || !bulkToNumber.trim()) {
      toast.error(
        <ToastNotify
          status={1}
          message="Vui lòng nhập khoảng số hóa đơn (từ số, đến số)"
        />,
        { style: styleError }
      );
      return;
    }
    const fromNum = parseInt(bulkFromNumber, 10);
    const toNum = parseInt(bulkToNumber, 10);
    if (isNaN(fromNum) || isNaN(toNum) || fromNum > toNum) {
      toast.error(
        <ToastNotify
          status={1}
          message="Khoảng số hóa đơn không hợp lệ. Từ số phải nhỏ hơn hoặc bằng đến số."
        />,
        { style: styleError }
      );
      return;
    }
    if (!bulkNewDate) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng chọn ngày hóa đơn mới" />,
        { style: styleError }
      );
      return;
    }

    setLoadingInvoices(true);
    setInvoiceList([]);

    (async () => {
      try {
        const domainSuffix = bulkTaxCode.endsWith("-998")
          ? ".minvoice.site"
          : ".minvoice.app";
        const baseUrl = `https://${bulkTaxCode}${domainSuffix}`;
        const getInfoUrl = `${baseUrl}/api/InvoiceApi78/GetInfoInvoice`;
        const saveUrl = `${baseUrl}/api/InvoiceApi78/Save`;

        const getInvoiceHeaders = {
          "Content-Type": "application/json",
          Authorization: SAVE_API_AUTH,
        };

        const results = [];

        // Quy định API: sửa ngày phải xử lý từ số lớn xuống số nhỏ (trên xuống)
        for (let number = toNum; number >= fromNum; number--) {
          try {
            const response = await axios.get(getInfoUrl, {
              params: { number, seri: selectedSeries },
              headers: getInvoiceHeaders,
            });

            if (
              !response?.data ||
              response.data.code !== "00" ||
              !response.data.data
            ) {
              results.push({
                number,
                seri: selectedSeries,
                hoadon68_id: null,
                inv_invoiceAuth_id: null,
                khieu: selectedSeries,
                shdon: number,
                tthai: "",
                status: "error",
                updateStatus: "error",
                updateError: response?.data?.message || "Không lấy được thông tin HĐ",
              });
              setInvoiceList([...results]);
              continue;
            }

            const invoice = response.data.data;
            const newDateStr = bulkNewDate.trim();
            const saveDataItem = mapInvoiceToSaveData(invoice, newDateStr);

            const savePayload = {
              editmode: invoice.editmode != null ? invoice.editmode : 2,
              data: [saveDataItem],
            };

            await axios.post(saveUrl, savePayload, {
              headers: SAVE_API_HEADERS,
            });

            results.push({
              number,
              seri: selectedSeries,
              hoadon68_id: invoice.hoadon68_id,
              inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
              khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
              shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
              tthai: invoice.tthai || "",
              status: "success",
              updateStatus: "success",
            });
          } catch (err) {
            const isGetError = !err.config?.method || err.config.method.toLowerCase() === "get";
            const msg =
              err?.response?.data?.message ||
              err?.response?.data?.Message ||
              err?.message ||
              "Lỗi không xác định";
            results.push({
              number,
              seri: selectedSeries,
              hoadon68_id: null,
              inv_invoiceAuth_id: null,
              khieu: selectedSeries,
              shdon: number,
              tthai: "",
              status: isGetError ? "error" : "success",
              updateStatus: "error",
              updateError: msg,
            });
          }
          setInvoiceList([...results]);
        }

        // Hiển thị danh sách theo số HĐ tăng dần (từ số → đến số)
        results.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
        setInvoiceList([...results]);

        const successCount = results.filter((r) => r.updateStatus === "success").length;
        const failCount = results.length - successCount;
        toast.info(
          <ToastNotify
            status={0}
            message={`Cập nhật ngày HĐ: ${successCount} thành công, ${failCount} thất bại (tổng ${results.length} hóa đơn).`}
          />,
          { style: styleSuccess }
        );
      } catch (error) {
        console.error("Error bulk update invoice dates:", error);
        toast.error(
          <ToastNotify
            status={1}
            message={
              error.response?.data?.message ||
              error.message ||
              "Lỗi khi cập nhật ngày hóa đơn hàng loạt"
            }
          />,
          { style: styleError }
        );
      } finally {
        setLoadingInvoices(false);
      }
    })();
  };

  // Xoá chứng từ TNCN: GET danh sách id (phân trang) rồi gọi API delete-many (mỗi lần 50 id)
  const handleDeleteTncnVouchers = async (e) => {
    e.preventDefault();
    const tax = tncnTaxCode.trim();
    const symbolId = tncnVoucherSymbolId.trim();
    const bearer = tncnBearerToken.trim();
    const xsrf = tncnRequestVerificationToken.trim();

    if (!tax || !symbolId || !bearer || !xsrf) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập đủ: Mã số thuế, Voucher Symbol ID, Bearer token, RequestVerificationToken" />,
        { style: styleError }
      );
      return;
    }

    setTncnLoading(true);
    setTncnLog({ totalFetched: 0, deleteSuccess: 0, deleteFail: 0 });

    const baseUrl = `https://${tax}.mtncn.minvoice.vn`;
    const pageSize = 300;
    const deleteManyBatchSize = 50;
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
      Authorization: bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`,
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Pragma: "no-cache",
      Referer: `${baseUrl}/chung-tu`,
      RequestVerificationToken: xsrf,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      __tenant: tax,
      Origin: baseUrl,
    };

    try {
      const allIds = [];
      let skipCount = 0;

      // GET danh sách chứng từ đến khi hết (skipCount tăng 300 mỗi lần)
      while (true) {
        const res = await axios.get(`${baseUrl}/api/app/voucher`, {
          params: { maxResultCount: pageSize, skipCount, voucherSymbolId: symbolId },
          headers,
        });
        const totalCount = res?.data?.totalCount ?? 0;
        const items = res?.data?.items ?? [];
        items.forEach((item) => {
          if (item.id) allIds.push(item.id);
        });
        setTncnLog((prev) => ({ ...prev, totalFetched: allIds.length }));
        if (items.length === 0 || items.length < pageSize || allIds.length >= totalCount) break;
        skipCount += pageSize;
      }

      if (allIds.length === 0) {
        toast.info(
          <ToastNotify status={0} message="Không có chứng từ nào để xoá." />,
          { style: styleSuccess }
        );
        setTncnLoading(false);
        return;
      }

      let deleteSuccess = 0;
      let deleteFail = 0;

      // Chia thành từng batch 50 id, gọi POST /api/app/voucher/delete-many với body là mảng id
      for (let i = 0; i < allIds.length; i += deleteManyBatchSize) {
        const chunk = allIds.slice(i, i + deleteManyBatchSize);
        try {
          await axios.post(`${baseUrl}/api/app/voucher/delete-many`, chunk, {
            headers,
          });
          deleteSuccess += chunk.length;
        } catch (err) {
          deleteFail += chunk.length;
          console.error(
            "delete-many batch failed:",
            chunk.length,
            err?.response?.data || err.message
          );
        }
        setTncnLog({ totalFetched: allIds.length, deleteSuccess, deleteFail });
        if (i + deleteManyBatchSize < allIds.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      toast.success(
        <ToastNotify
          status={0}
          message={`Xoá chứng từ TNCN: ${deleteSuccess} thành công, ${deleteFail} thất bại (tổng ${allIds.length} bản ghi, gửi mỗi lần 50 id).`}
        />,
        { style: styleSuccess }
      );
    } catch (error) {
      console.error("Error TNCN delete flow:", error);
      toast.error(
        <ToastNotify
          status={1}
          message={error?.response?.data?.message || error?.message || "Lỗi khi lấy danh sách hoặc xoá chứng từ TNCN"}
        />,
        { style: styleError }
      );
    } finally {
      setTncnLoading(false);
    }
  };

  // Tạo hóa đơn hàng loạt: copy hóa đơn cũ và tạo hóa đơn mới với ngày hiện tại (editmode: 1)
  const handleBulkCreateInvoices = async () => {
    // Validate basic input (giống cập nhật ngày)
    if (!bulkTaxCode.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập mã số thuế" />,
        { style: styleError }
      );
      return;
    }
    if (!selectedSeries) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng chọn ký hiệu" />,
        { style: styleError }
      );
      return;
    }
    if (!bulkFromNumber.trim() || !bulkToNumber.trim()) {
      toast.error(
        <ToastNotify
          status={1}
          message="Vui lòng nhập khoảng số hóa đơn (từ số, đến số)"
        />,
        { style: styleError }
      );
      return;
    }
    const fromNum = parseInt(bulkFromNumber, 10);
    const toNum = parseInt(bulkToNumber, 10);
    if (isNaN(fromNum) || isNaN(toNum) || fromNum > toNum) {
      toast.error(
        <ToastNotify
          status={1}
          message="Khoảng số hóa đơn không hợp lệ. Từ số phải nhỏ hơn hoặc bằng đến số."
        />,
        { style: styleError }
      );
      return;
    }

    setLoadingInvoices(true);
    setInvoiceList([]);

    try {
      const domainSuffix = bulkTaxCode.endsWith("-998")
        ? ".minvoice.site"
        : ".minvoice.app";
      const baseUrl = `https://${bulkTaxCode}${domainSuffix}`;
      const getInfoUrl = `${baseUrl}/api/InvoiceApi78/GetInfoInvoice`;
      const saveUrl = `${baseUrl}/api/InvoiceApi78/Save`;

      const getInvoiceHeaders = {
        "Content-Type": "application/json",
        Authorization: SAVE_API_AUTH,
      };

      const results = [];
      const todayStr = new Date().toISOString().slice(0, 10);

      // Xử lý từ số lớn xuống số nhỏ để bám theo logic hiện tại
      for (let number = toNum; number >= fromNum; number--) {
        try {
          const response = await axios.get(getInfoUrl, {
            params: { number, seri: selectedSeries },
            headers: getInvoiceHeaders,
          });

          if (
            !response?.data ||
            response.data.code !== "00" ||
            !response.data.data
          ) {
            results.push({
              number,
              seri: selectedSeries,
              hoadon68_id: null,
              inv_invoiceAuth_id: null,
              khieu: selectedSeries,
              shdon: number,
              tthai: "",
              status: "error",
              updateStatus: "error",
              updateError:
                response?.data?.message || "Không lấy được thông tin HĐ để tạo mới",
            });
            setInvoiceList([...results]);
            continue;
          }

          const invoice = response.data.data;
          // Chỉ tạo mới khi đủ một trong hai: trang_thai = 5 HOẶC tthai = "Chờ ký"
          const statusText = (invoice.tthai || invoice.trang_thai_text || "").trim();
          const rawTrangThai = invoice.trang_thai;
          const trangThaiNum =
            typeof rawTrangThai === "number" && !Number.isNaN(rawTrangThai)
              ? rawTrangThai
              : rawTrangThai != null && String(rawTrangThai).trim() !== ""
                ? parseInt(String(rawTrangThai).trim(), 10)
                : NaN;
          const isChoKy =
            trangThaiNum === 5 || statusText === "Chờ ký";
          if (!isChoKy) {
            results.push({
              number,
              seri: selectedSeries,
              hoadon68_id: invoice.hoadon68_id,
              inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
              khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
              shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
              tthai: statusText || (Number.isNaN(trangThaiNum) ? "" : String(trangThaiNum)),
              status: "skipped",
              updateStatus: "skipped",
              updateError:
                "Bỏ qua: chỉ tạo mới khi trang_thai = 5 hoặc tthai = \"Chờ ký\"",
            });
            setInvoiceList([...results]);
            continue;
          }
          // Map dữ liệu và set ngày hóa đơn là ngày hiện tại
          const saveDataItem = mapInvoiceToSaveData(invoice, todayStr);
          // Khi tạo mới, nếu giữ nguyên key_api sẽ bị backend check trùng → bỏ key_api để backend tự sinh
          const newDataItem = { ...saveDataItem };
          delete newDataItem.key_api;

          const savePayload = {
            editmode: 1, // Tạo mới
            data: [newDataItem],
          };

          await axios.post(saveUrl, savePayload, {
            headers: SAVE_API_HEADERS,
          });

          results.push({
            number,
            seri: selectedSeries,
            hoadon68_id: invoice.hoadon68_id,
            inv_invoiceAuth_id: invoice.inv_invoiceAuth_id,
            khieu: invoice.inv_invoiceSeries || invoice.khieu || selectedSeries,
            shdon: invoice.inv_invoiceNumber || invoice.shdon || number,
            tthai: invoice.tthai || "",
            status: "success",
            updateStatus: "success",
          });
        } catch (err) {
          const message =
            err?.response?.data?.message ||
            err?.response?.data?.Message ||
            err?.message ||
            "Lỗi không xác định khi tạo mới hóa đơn";
          results.push({
            number,
            seri: selectedSeries,
            hoadon68_id: null,
            inv_invoiceAuth_id: null,
            khieu: selectedSeries,
            shdon: number,
            tthai: "",
            status: "error",
            updateStatus: "error",
            updateError: message,
          });
        }
        setInvoiceList([...results]);
      }

      // Sắp xếp lại kết quả theo số hóa đơn tăng dần để dễ xem
      results.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      setInvoiceList([...results]);

      const successCount = results.filter((r) => r.updateStatus === "success").length;
      const failCount = results.filter((r) => r.updateStatus !== "success").length;
      toast.info(
        <ToastNotify
          status={0}
          message={`Tạo mới hóa đơn: ${successCount} thành công, ${failCount} thất bại`}
        />,
        { style: styleSuccess }
      );
    } catch (error) {
      console.error("Lỗi khi tạo hóa đơn hàng loạt:", error);
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.Message ||
        error?.message ||
        "Lỗi không xác định khi tạo hóa đơn hàng loạt";
      toast.error(
        <ToastNotify status={1} message={message} />,
        { style: styleError }
      );
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!khhdonList.trim()) {
      toast.error(
        <ToastNotify status={1} message="Vui lòng nhập danh sách ký hiệu" />,
        { style: styleError }
      );
      return;
    }

    // Parse danh sách ký hiệu (mỗi dòng một ký hiệu)
    const khhdonArray = khhdonList
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (khhdonArray.length === 0) {
      toast.error(
        <ToastNotify status={1} message="Danh sách ký hiệu không hợp lệ" />,
        { style: styleError }
      );
      return;
    }

    setProcessing(true);
    setResults([]);

    const newResults = [];
    let successCount = 0;
    let failCount = 0;

    // Lặp qua từng ký hiệu và gọi API
    for (let i = 0; i < khhdonArray.length; i++) {
      const khhdon = khhdonArray[i];
      const result = await createSerial(khhdon);
      newResults.push(result);

      if (result.success) {
        successCount++;
        toast.success(<ToastNotify status={0} message={result.message} />, {
          style: styleSuccess,
        });
      } else {
        failCount++;
        toast.error(<ToastNotify status={1} message={result.message} />, {
          style: styleError,
        });
      }

      // Cập nhật kết quả sau mỗi request
      setResults([...newResults]);
    }

    setProcessing(false);

    // Thông báo tổng kết
    toast.info(
      <ToastNotify
        status={0}
        message={`Hoàn thành: ${successCount} thành công, ${failCount} thất bại`}
      />,
      { style: styleSuccess }
    );
  };

  // --- Kiểm tra đang gửi hàng loạt: lấy tài khoản 2.0 và mở link đăng nhập
  const handleGetAccount20 = async () => {
    const tax = (checkTaxCode || "").trim().replace(/-/g, "");
    if (!tax) {
      toast.error(<ToastNotify status={-1} message="Vui lòng nhập mã số thuế" />, { style: styleError });
      return;
    }
    const storedAccountString = localStorage.getItem("account");
    if (!storedAccountString) {
      toast.error(<ToastNotify status={-1} message="Vui lòng đăng nhập CRM trước" />, { style: styleError });
      return;
    }
    let storedAccount;
    try {
      storedAccount = JSON.parse(storedAccountString);
    } catch {
      toast.error(<ToastNotify status={-1} message="Dữ liệu đăng nhập CRM không hợp lệ" />, { style: styleError });
      return;
    }
    if (!storedAccount.username || !storedAccount.password || !storedAccount.madvcs) {
      toast.error(<ToastNotify status={-1} message="Vui lòng đăng nhập CRM đầy đủ (username, password, mã ĐVCS)" />, { style: styleError });
      return;
    }
    setLoadingCheckAccount(true);
    setCheckAccount20(null);
    try {
      const tokenCrmRes = await GetTokenCRM(
        storedAccount.username,
        storedAccount.password,
        storedAccount.madvcs
      );
      if (!tokenCrmRes?.token) {
        toast.error(<ToastNotify status={-1} message="Không lấy được token CRM" />, { style: styleError });
        return;
      }
      const tokenNewApp = await ResetPasswordNewApp(tax, tokenCrmRes.token);
      if (!tokenNewApp?.token?.data) {
        toast.error(<ToastNotify status={-1} message="Không lấy được tài khoản 2.0 cho MST này" />, { style: styleError });
        return;
      }
      const account = tokenNewApp.token.data.account;
      const password = tokenNewApp.token.data.passWord;
      setCheckAccount20({ account, password });
      const newWindow = window.open(`https://${tax}.minvoice.net/#/`, "_blank");
      // Cơ chế như InsertCKS: lắng nghe postMessage từ trang 2.0 để lưu cookie (khi user đăng nhập xong chạy script trên trang 2.0)
      if (newWindow) {
        const messageHandler = (event) => {
          if (event.data?.type === "COOKIES_SAVED" && event.data?.taxCode === tax) {
            const cookies = event.data.cookies;
            if (cookies) {
              try {
                localStorage.setItem(`minv_tool_cookies_${tax}`, cookies);
              } catch (e) {
                console.warn("Lưu cookie thất bại:", e);
              }
            }
          }
        };
        window.addEventListener("message", messageHandler);
        setTimeout(() => {
          window.removeEventListener("message", messageHandler);
        }, 300000);
      }
      toast.success(
        <ToastNotify status={0} message="Đã lấy tài khoản 2.0 và mở link đăng nhập. Đăng nhập xong quay lại, bấm Lấy danh sách ký hiệu rồi chọn tờ khai." />,
        { style: styleSuccess }
      );
    } catch (err) {
      console.error(err);
      toast.error(<ToastNotify status={-1} message={err?.message || "Lỗi khi lấy tài khoản 2.0"} />, { style: styleError });
    } finally {
      setLoadingCheckAccount(false);
    }
  };

  // --- Kiểm tra đang gửi hàng loạt: lấy danh sách ký hiệu bằng API GetTypeInvoiceSeries (cùng hàm get series)
  const handleFetchCheckRegisterList = async () => {
    const taxCodeInput = (checkTaxCode || "").trim();
    if (!taxCodeInput) {
      toast.error(<ToastNotify status={-1} message="Vui lòng nhập mã số thuế" />, { style: styleError });
      return;
    }
    setLoadingCheckRegisterList(true);
    setCheckRegisterList([]);
    setCheckRegisterInvoiceId("");
    const domain = taxCodeInput.endsWith("-998") ? ".minvoice.site" : ".minvoice.app";
    const url = `https://${taxCodeInput}${domain}/api/InvoiceApi78/GetTypeInvoiceSeries`;
    const headers = {
      Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
      "Content-Type": "application/json",
    };
    try {
      const response = await axios.get(url, { headers });
      if (response?.data?.code === "00" && Array.isArray(response?.data?.data)) {
        const data = response.data.data;
        const list = data.map((s) => ({
          id: s.id,
          name: s.khhdon ? `${s.khhdon}${s.invoiceTypeName ? " - " + s.invoiceTypeName : ""}` : (s.invoiceTypeName || s.id),
        })).filter((s) => s.id);
        setCheckRegisterList(list);
        if (list.length === 0) {
          toast.warning(<ToastNotify status={1} message="Không tìm thấy ký hiệu nào" />, { style: styleError });
        } else {
          toast.success(<ToastNotify status={0} message={`Đã lấy ${list.length} ký hiệu`} />, { style: styleSuccess });
        }
      } else {
        throw new Error(response?.data?.message || "Không thể lấy danh sách ký hiệu");
      }
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.message || "Lỗi khi lấy danh sách ký hiệu";
      toast.error(<ToastNotify status={-1} message={msg} />, { style: styleError });
    } finally {
      setLoadingCheckRegisterList(false);
    }
  };

  // --- Kiểm tra đang gửi hàng loạt: lấy danh sách hóa đơn trạng thái đang gửi (sendTaxStatus=3)
  const handleFetchSendingList = async () => {
    const tax = (checkTaxCode || "").trim().replace(/-/g, "");
    const regId = (checkRegisterInvoiceId || "").trim();
    if (!tax) {
      toast.error(<ToastNotify status={-1} message="Vui lòng nhập mã số thuế" />, { style: styleError });
      return;
    }
    if (!regId) {
      toast.error(<ToastNotify status={-1} message="Vui lòng chọn ký hiệu (tờ khai đăng ký)" />, { style: styleError });
      return;
    }
    setLoadingCheckList(true);
    setCheckInvoiceList([]);
    setCheckResults([]);
    const baseUrl = `https://${tax}.minvoice.net`;
    const PAGE_SIZE = 50;
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      Pragma: "no-cache",
      Referer: `${baseUrl}/`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    };
    try {
      let allItems = [];
      let skipCount = 0;
      let totalCount = null;
      do {
        const url = `${baseUrl}/api/api/app/invoice?maxResultCount=${PAGE_SIZE}&skipCount=${skipCount}&sendTaxStatus=3&registerInvoiceId=${encodeURIComponent(regId)}&loadAll=false`;
        const res = await axios.get(url, { headers, withCredentials: true });
        const data = res.data;
        const items = Array.isArray(data.items) ? data.items : [];
        allItems = allItems.concat(items);
        if (totalCount == null && typeof data.totalCount === "number") totalCount = data.totalCount;
        if (items.length < PAGE_SIZE) break;
        skipCount += PAGE_SIZE;
        setCheckInvoiceList([...allItems]);
      } while (totalCount == null || allItems.length < totalCount);
      setCheckInvoiceList(allItems);
      toast.success(
        <ToastNotify status={0} message={`Đã lấy ${allItems.length} hóa đơn trạng thái đang gửi`} />,
        { style: styleSuccess }
      );
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.message || "Lỗi khi lấy danh sách";
      toast.error(<ToastNotify status={-1} message={msg} />, { style: styleError });
    } finally {
      setLoadingCheckList(false);
    }
  };

  // --- Kiểm tra đang gửi hàng loạt: gọi m-gate-way/result cho từng hóa đơn
  const handleBatchCheck = async () => {
    if (!checkInvoiceList.length) {
      toast.error(<ToastNotify status={-1} message="Hãy lấy danh sách đang gửi trước" />, { style: styleError });
      return;
    }
    const tax = (checkTaxCode || "").trim().replace(/-/g, "");
    if (!tax) {
      toast.error(<ToastNotify status={-1} message="Vui lòng nhập mã số thuế" />, { style: styleError });
      return;
    }
    setLoadingCheckBatch(true);
    const baseUrl = `https://${tax}.minvoice.net`;
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      Pragma: "no-cache",
      Referer: `${baseUrl}/`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    };
    const results = [];
    for (let i = 0; i < checkInvoiceList.length; i++) {
      const inv = checkInvoiceList[i];
      const id = inv.id;
      if (!id) continue;
      try {
        const res = await axios.get(
          `${baseUrl}/api/api/app/m-gate-way/result/${id}?type=Invoice,InvoiceCode,InvoiceCash`,
          { headers, withCredentials: true }
        );
        results.push({
          id,
          invoiceNumber: inv.invoiceNumber,
          invoiceSerial: inv.invoiceSerial,
          status: "ok",
          data: res.data,
        });
      } catch (err) {
        results.push({
          id,
          invoiceNumber: inv.invoiceNumber,
          invoiceSerial: inv.invoiceSerial,
          status: "error",
          message: err?.response?.data?.message || err?.message || "Lỗi",
        });
      }
      setCheckResults([...results]);
    }
    setLoadingCheckBatch(false);
    toast.success(
      <ToastNotify status={0} message={`Đã kiểm tra ${results.length} hóa đơn`} />,
      { style: styleSuccess }
    );
  };

  return (
    <div
      className="support-container"
      style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}
    >
      <ToastContainer />

      {/* Tab Navigation */}
      <div style={{ marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <button
          onClick={() => setActiveTab("create-serial")}
          style={{
            display: "none", // Ẩn tab "Tạo hàng loạt ký hiệu"
            padding: "10px 20px",
            backgroundColor:
              activeTab === "create-serial" ? "#007bff" : "transparent",
            color: activeTab === "create-serial" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "create-serial" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "create-serial" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Tạo hàng loạt ký hiệu
        </button>
        <button
          onClick={() => setActiveTab("get-files")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "get-files" ? "#007bff" : "transparent",
            color: activeTab === "get-files" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "get-files" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "get-files" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Cập nhật chứng từ TNCN
        </button>
        <button
          onClick={() => setActiveTab("update-error")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "update-error" ? "#007bff" : "transparent",
            color: activeTab === "update-error" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "update-error" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "update-error" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Cập nhật HĐ lỗi
        </button>
        <button
          onClick={() => setActiveTab("fill-gap")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "fill-gap" ? "#007bff" : "transparent",
            color: activeTab === "fill-gap" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "fill-gap" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "fill-gap" ? "bold" : "normal",
          }}
        >
          Lấp lủng HĐ
        </button>
        <button
          onClick={() => setActiveTab("bulk-update-date")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "bulk-update-date" ? "#007bff" : "transparent",
            color:
              activeTab === "bulk-update-date" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "bulk-update-date"
                ? "2px solid #007bff"
                : "none",
            cursor: "pointer",
            fontWeight:
              activeTab === "bulk-update-date" ? "bold" : "normal",
            marginLeft: "10px",
          }}
        >
          Cập nhật ngày HĐ hàng loạt
        </button>
        <button
          onClick={() => setActiveTab("check-sending")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "check-sending" ? "#007bff" : "transparent",
            color: activeTab === "check-sending" ? "white" : "#007bff",
            border: "none",
            borderBottom:
              activeTab === "check-sending" ? "2px solid #007bff" : "none",
            cursor: "pointer",
            fontWeight: activeTab === "check-sending" ? "bold" : "normal",
            marginRight: "10px",
          }}
        >
          Kiểm tra đang gửi hàng loạt
        </button>
        {SHOW_TNCN_DELETE && (
          <button
            onClick={() => setActiveTab("delete-tncn")}
            style={{
              padding: "10px 20px",
              backgroundColor:
                activeTab === "delete-tncn" ? "#007bff" : "transparent",
              color: activeTab === "delete-tncn" ? "white" : "#007bff",
              border: "none",
              borderBottom:
                activeTab === "delete-tncn" ? "2px solid #007bff" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "delete-tncn" ? "bold" : "normal",
              marginRight: "10px",
            }}
          >
            Xoá chứng từ TNCN
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "create-serial" && (
        <>
          <h1 style={{ marginBottom: "20px" }}>Tạo hàng loạt ký hiệu</h1>

          <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Danh sách ký hiệu (mỗi dòng một ký hiệu)
              </label>
              <textarea
                value={khhdonList}
                onChange={(e) => setKhhdonList(e.target.value)}
                placeholder="1C26TES&#10;1C27TES&#10;1C28TES"
                rows={15}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                }}
              />
              <div
                style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}
              >
                Nhập mỗi ký hiệu trên một dòng. Ví dụ: 1C26TES, 1C27TES, 1C28TES
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              style={{
                padding: "12px 24px",
                backgroundColor: processing ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                cursor: processing ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {processing ? "Đang xử lý..." : "Tạo hàng loạt"}
            </button>
          </form>

          {results.length > 0 && (
            <div style={{ marginTop: "30px" }}>
              <h2 style={{ marginBottom: "15px" }}>Kết quả</h2>
              <div
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "2px solid #ddd",
                        }}
                      >
                        STT
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "2px solid #ddd",
                        }}
                      >
                        Ký hiệu
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "2px solid #ddd",
                        }}
                      >
                        Trạng thái
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "2px solid #ddd",
                        }}
                      >
                        Thông báo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr
                        key={index}
                        style={{
                          backgroundColor: result.success
                            ? "#d4edda"
                            : "#f8d7da",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        <td style={{ padding: "10px" }}>{index + 1}</td>
                        <td style={{ padding: "10px", fontWeight: "bold" }}>
                          {result.khhdon}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              backgroundColor: result.success
                                ? "#28a745"
                                : "#dc3545",
                              color: "white",
                              fontSize: "12px",
                            }}
                          >
                            {result.success ? "Thành công" : "Thất bại"}
                          </span>
                        </td>
                        <td style={{ padding: "10px", fontSize: "12px" }}>
                          {result.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "get-files" && <GetInvoiceFiles />}

      {activeTab === "check-sending" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>Kiểm tra đang gửi hàng loạt</h1>
          <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
            Lấy tài khoản 2.0 và mở link đăng nhập → đăng nhập trên trang 2.0 (cookie/session lấy theo link đó) → Lấy danh sách ký hiệu và chọn tờ khai đăng ký → Lấy danh sách đang gửi → Kiểm tra hàng loạt.
          </p>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              maxWidth: "800px",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>
                Mã số thuế
              </label>
              <input
                type="text"
                value={checkTaxCode}
                onChange={(e) => setCheckTaxCode(e.target.value)}
                placeholder="VD: 3700143591"
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <button
                type="button"
                onClick={handleGetAccount20}
                disabled={loadingCheckAccount}
                style={{
                  padding: "10px 20px",
                  backgroundColor: loadingCheckAccount ? "#ccc" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: loadingCheckAccount ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {loadingCheckAccount ? "Đang lấy..." : "Lấy tài khoản 2.0 & mở link đăng nhập"}
              </button>
              {checkAccount20 && (
                <div style={{ marginTop: "8px", fontSize: "13px", color: "#333" }}>
                  Tài khoản: <strong>{checkAccount20.account}</strong> — Mật khẩu: <strong>{checkAccount20.password}</strong>
                </div>
              )}
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>
                Ký hiệu (tờ khai đăng ký)
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleFetchCheckRegisterList}
                  disabled={loadingCheckRegisterList || !checkTaxCode.trim()}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: loadingCheckRegisterList || !checkTaxCode.trim() ? "#ccc" : "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "13px",
                    cursor: loadingCheckRegisterList || !checkTaxCode.trim() ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loadingCheckRegisterList ? "Đang tải..." : "Lấy danh sách ký hiệu"}
                </button>
              </div>
              <div style={{ marginTop: "12px", maxWidth: "480px" }}>
                <Dropdown
                  inputId="checkRegisterInvoice"
                  value={
                    checkRegisterInvoiceId &&
                    checkRegisterDropdownOptions.some((o) => o.value === checkRegisterInvoiceId)
                      ? checkRegisterInvoiceId
                      : null
                  }
                  options={checkRegisterDropdownOptions}
                  onChange={(e) => setCheckRegisterInvoiceId(e.value ?? "")}
                  optionLabel="label"
                  optionValue="value"
                  placeholder={
                    checkRegisterList.length === 0
                      ? "Lấy danh sách ký hiệu trước..."
                      : "Chọn ký hiệu (tờ khai đăng ký)..."
                  }
                  filter
                  filterBy="label,value"
                  filterPlaceholder="Tìm theo tên ký hiệu hoặc ID..."
                  showClear
                  emptyMessage="Chưa có dữ liệu — bấm “Lấy danh sách ký hiệu”"
                  emptyFilterMessage="Không tìm thấy ký hiệu phù hợp"
                  disabled={checkRegisterList.length === 0 || loadingCheckRegisterList}
                  className="w-full"
                  panelStyle={{ maxHeight: "320px" }}
                  style={{ width: "100%" }}
                />
                {checkRegisterList.length > 0 && (
                  <small style={{ display: "block", marginTop: "6px", color: "#666", fontSize: "12px" }}>
                    <i className="pi pi-filter" style={{ marginRight: "4px" }} />
                    Gõ trong ô tìm kiếm của dropdown để lọc nhanh ({checkRegisterList.length} ký hiệu).
                  </small>
                )}
              </div>
            </div>
            <div style={{ marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleFetchSendingList}
                disabled={loadingCheckList}
                style={{
                  padding: "10px 20px",
                  backgroundColor: loadingCheckList ? "#ccc" : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: loadingCheckList ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {loadingCheckList ? "Đang lấy danh sách..." : "Lấy danh sách đang gửi"}
              </button>
              <button
                type="button"
                onClick={handleBatchCheck}
                disabled={loadingCheckBatch || !checkInvoiceList.length}
                style={{
                  padding: "10px 20px",
                  backgroundColor: loadingCheckBatch || !checkInvoiceList.length ? "#ccc" : "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: loadingCheckBatch || !checkInvoiceList.length ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {loadingCheckBatch ? "Đang kiểm tra..." : `Kiểm tra hàng loạt (${checkInvoiceList.length})`}
              </button>
            </div>
            {checkInvoiceList.length > 0 && (
              <div style={{ marginTop: "16px", fontSize: "13px", color: "#333" }}>
                Đã lấy <strong>{checkInvoiceList.length}</strong> hóa đơn trạng thái đang gửi.
              </div>
            )}
            {checkResults.length > 0 && (
              <div style={{ marginTop: "20px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f1f1f1" }}>
                      <th style={{ padding: "8px", border: "1px solid #ddd", textAlign: "left" }}>Ký hiệu</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", textAlign: "left" }}>Số HĐ</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", textAlign: "left" }}>Trạng thái</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", textAlign: "left" }}>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkResults.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{r.invoiceSerial}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{r.invoiceNumber}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{r.status === "ok" ? "OK" : "Lỗi"}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd", maxWidth: "300px", wordBreak: "break-all" }}>
                          {r.status === "ok" ? JSON.stringify(r.data) : (r.message || "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "update-error" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>Cập nhật HĐ lỗi</h1>
          
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              maxWidth: "600px",
            }}
          >
            {/* Input mã số thuế */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                Mã số thuế
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  placeholder="Nhập mã số thuế (ví dụ: 3500578186)"
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleGetSeries();
                    }
                  }}
                />
                <button
                  onClick={handleGetSeries}
                  disabled={!taxCode.trim() || loadingSeries}
                  style={{
                    padding: "10px 20px",
                    backgroundColor:
                      !taxCode.trim() || loadingSeries ? "#ccc" : "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor:
                      !taxCode.trim() || loadingSeries
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loadingSeries ? "Đang tải..." : "Lấy ký hiệu"}
                </button>
              </div>
            </div>

            {/* Dropdown chọn ký hiệu */}
            {seriesList.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Chọn ký hiệu
                </label>
                <select
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  <option value="">-- Chọn ký hiệu --</option>
                  {seriesList.map((series) => (
                    <option key={series.id} value={series.khhdon}>
                      {series.khhdon} - {series.invoiceTypeName}
                    </option>
                  ))}
                </select>
                {selectedSeries && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#e7f3ff",
                      borderRadius: "4px",
                      fontSize: "13px",
                      color: "#0066cc",
                    }}
                  >
                    Đã chọn: <strong>{selectedSeries}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Input token */}
            {selectedSeries && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <label
                    style={{
                      fontWeight: "bold",
                      fontSize: "14px",
                      margin: 0,
                    }}
                  >
                    Token
                  </label>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                    onMouseEnter={() => setShowTokenTooltip(true)}
                    onMouseLeave={() => setShowTokenTooltip(false)}
                  >
                    <i
                      className="fa-solid fa-circle-info"
                      style={{
                        color: "#007bff",
                        cursor: "pointer",
                        fontSize: "16px",
                      }}
                    ></i>
                    {showTokenTooltip && (
                      <div
                        style={{
                          position: "absolute",
                          left: "20px",
                          top: "0",
                          backgroundColor: "#333",
                          color: "#fff",
                          padding: "12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          width: "320px",
                          zIndex: 1000,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          lineHeight: "1.6",
                        }}
                      >
                        <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
                          Hướng dẫn lấy token:
                        </div>
                        <ol style={{ margin: 0, paddingLeft: "20px" }}>
                          <li>Truy cập: <a href="https://msupport.minvoice.com.vn/Update" target="_blank" rel="noopener noreferrer" style={{ color: "#4da6ff" }}>https://msupport.minvoice.com.vn/Update</a></li>
                          <li>Nhấn <strong>F12</strong> để mở Developer Tools</li>
                          <li>Chọn tab <strong>Application</strong></li>
                          <li>Mở <strong>Storage</strong> → <strong>Local storage</strong></li>
                          <li>Tìm key <strong>"token"</strong> và copy giá trị</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Nhập token để cập nhật hóa đơn"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>
            )}

            {/* Input từ số - đến số */}
            {selectedSeries && (
              <>
                <div style={{ marginTop: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    Số hóa đơn
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="number"
                      value={tuSo}
                      onChange={(e) => setTuSo(e.target.value)}
                      placeholder="Từ số"
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "14px",
                      }}
                    />
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>-</span>
                    <input
                      type="number"
                      value={denSo}
                      onChange={(e) => setDenSo(e.target.value)}
                      placeholder="Đến số"
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <button
                    onClick={handleUpdateErrorInvoices}
                    disabled={!tuSo.trim() || !denSo.trim() || !token.trim() || loadingInvoices}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor:
                        !tuSo.trim() || !denSo.trim() || !token.trim() || loadingInvoices
                          ? "#ccc"
                          : "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "14px",
                      cursor:
                        !tuSo.trim() || !denSo.trim() || !token.trim() || loadingInvoices
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {loadingInvoices ? "Đang cập nhật..." : "Cập nhật lỗi"}
                  </button>
                </div>
              </>
            )}

            {/* Hiển thị kết quả danh sách hóa đơn */}
            {invoiceList.length > 0 && (
              <div style={{ marginTop: "30px" }}>
                <h3 style={{ marginBottom: "15px", fontSize: "16px", fontWeight: "bold" }}>
                  Kết quả cập nhật hóa đơn ({invoiceList.length})
                </h3>
                <div
                  style={{
                    maxHeight: "400px",
                    overflowY: "auto",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: "white",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f8f9fa",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          STT
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Ký hiệu
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Số HĐ
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          ID Hóa đơn
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Trạng thái
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            textAlign: "left",
                            borderBottom: "2px solid #dee2e6",
                            fontWeight: "bold",
                          }}
                        >
                          Kết quả cập nhật
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceList.map((invoice, index) => (
                        <tr
                          key={`${invoice.seri}-${invoice.number}-${index}`}
                          style={{
                            borderBottom: "1px solid #dee2e6",
                            backgroundColor: 
                              invoice.status === "success"
                                ? index % 2 === 0 ? "#f0fdf4" : "#dcfce7"
                                : index % 2 === 0 ? "#fff" : "#f8f9fa",
                          }}
                        >
                          <td style={{ padding: "10px" }}>{index + 1}</td>
                          <td style={{ padding: "10px" }}>
                            {invoice.khieu || invoice.seri || "-"}
                          </td>
                          <td style={{ padding: "10px" }}>
                            {invoice.shdon || invoice.number || "-"}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              fontFamily: "monospace",
                              fontSize: "11px",
                              wordBreak: "break-all",
                            }}
                          >
                            {invoice.hoadon68_id || (
                              <span style={{ color: "#dc2626", fontSize: "10px" }}>
                                {invoice.error || "Không tìm thấy"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px" }}>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                backgroundColor:
                                  invoice.status === "success"
                                    ? invoice.tthai === "Đã gửi"
                                      ? "#d4edda"
                                      : invoice.tthai === "Chưa gửi"
                                      ? "#fff3cd"
                                      : "#e7f3ff"
                                    : "#f8d7da",
                                color:
                                  invoice.status === "success"
                                    ? invoice.tthai === "Đã gửi"
                                      ? "#155724"
                                      : invoice.tthai === "Chưa gửi"
                                      ? "#856404"
                                      : "#0066cc"
                                    : "#721c24",
                              }}
                            >
                              {invoice.tthai || "N/A"}
                            </span>
                            {invoice.updateStatus === "success" && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  backgroundColor: "#d4edda",
                                  color: "#155724",
                                }}
                              >
                                ✓ Đã cập nhật
                              </span>
                            )}
                            {invoice.updateStatus === "error" && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  backgroundColor: "#f8d7da",
                                  color: "#721c24",
                                }}
                              >
                                ✗ Lỗi
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px" }}>
                            {invoice.updateStatus === "success" && (
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: "#d4edda",
                                  color: "#155724",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓ Thành công
                              </span>
                            )}
                            {invoice.updateStatus === "error" && (
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: "#f8d7da",
                                  color: "#721c24",
                                  fontWeight: "bold",
                                }}
                                title={invoice.updateError || "Lỗi"}
                              >
                                ✗ Thất bại
                              </span>
                            )}
                            {!invoice.updateStatus && invoice.status === "error" && (
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: "#f8d7da",
                                  color: "#721c24",
                                  fontWeight: "bold",
                                }}
                              >
                                ✗ Lỗi lấy thông tin
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hiển thị lỗi nếu có */}
            {loadingSeries === false && seriesList.length === 0 && taxCode && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px",
                  backgroundColor: "#fff3cd",
                  borderRadius: "4px",
                  fontSize: "13px",
                  color: "#856404",
                }}
              >
                Không tìm thấy ký hiệu nào. Vui lòng kiểm tra lại mã số thuế.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "bulk-update-date" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>
            Cập nhật ngày HĐ hàng loạt
          </h1>

          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              maxWidth: "800px",
            }}
          >
            <form onSubmit={handleBulkUpdateInvoiceDates}>
              {/* Mã số thuế */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Mã số thuế
                </label>
                <input
                  type="text"
                  value={bulkTaxCode}
                  onChange={(e) => {
                    setBulkTaxCode(e.target.value);
                    // Đồng bộ với taxCode để tái sử dụng handleGetSeries & seriesList
                    setTaxCode(e.target.value);
                  }}
                  placeholder="VD: 0106026495-998"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              {/* Chọn ký hiệu (reuse seriesList & selectedSeries từ tab Cập nhật HĐ lỗi) */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Chọn ký hiệu
                </label>
                <select
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    cursor: seriesList.length > 0 ? "pointer" : "not-allowed",
                  }}
                  disabled={seriesList.length === 0}
                >
                  <option value="">
                    {seriesList.length === 0
                      ? "-- Nhập mã số thuế để tải ký hiệu --"
                      : "-- Chọn ký hiệu --"}
                  </option>
                  {seriesList.map((series) => (
                    <option key={series.id} value={series.khhdon}>
                      {series.khhdon} - {series.invoiceTypeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Từ số - Đến số */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Khoảng số hóa đơn
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="number"
                    value={bulkFromNumber}
                    onChange={(e) => setBulkFromNumber(e.target.value)}
                    placeholder="Từ số"
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                  <input
                    type="number"
                    value={bulkToNumber}
                    onChange={(e) => setBulkToNumber(e.target.value)}
                    placeholder="Đến số"
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  Nhập khoảng số hóa đơn cần cập nhật (ví dụ: từ 1 đến 50).
                </div>
              </div>

              {/* Ngày hóa đơn mới */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Ngày hóa đơn mới
                </label>
                <input
                  type="date"
                  value={bulkNewDate}
                  onChange={(e) => setBulkNewDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  Ngày này sẽ được áp dụng cho tất cả hóa đơn trong khoảng số ở trên.
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={loadingInvoices}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: loadingInvoices ? "#ccc" : "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor: loadingInvoices ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {loadingInvoices
                    ? "Đang lấy và cập nhật ngày HĐ..."
                    : "Lấy từng HĐ và cập nhật ngày (Save API)"}
                </button>

                <button
                  type="button"
                  onClick={handleBulkCreateInvoices}
                  disabled={loadingInvoices}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: loadingInvoices ? "#ccc" : "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor: loadingInvoices ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {loadingInvoices
                    ? "Đang tạo mới hóa đơn..."
                    : "Tạo mới hóa đơn theo khoảng số (ngày hôm nay)"}
                </button>
              </div>
            </form>

            {invoiceList.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: "bold" }}>
                  Kết quả cập nhật ngày HĐ ({invoiceList.length})
                </h3>
                <div
                  style={{
                    maxHeight: "360px",
                    overflowY: "auto",
                    border: "1px solid #dee2e6",
                    borderRadius: "8px",
                    backgroundColor: "white",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8f9fa" }}>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>STT</th>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Ký hiệu</th>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Số HĐ</th>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceList.map((inv, idx) => (
                        <tr
                          key={`bulk-${inv.seri}-${inv.number}-${idx}`}
                          style={{
                            borderBottom: "1px solid #dee2e6",
                            backgroundColor: inv.updateStatus === "success" ? "#f0fdf4" : "#fef2f2",
                          }}
                        >
                          <td style={{ padding: "8px" }}>{idx + 1}</td>
                          <td style={{ padding: "8px" }}>{inv.khieu || inv.seri || "-"}</td>
                          <td style={{ padding: "8px" }}>{inv.shdon ?? inv.number ?? "-"}</td>
                          <td style={{ padding: "8px" }}>
                            {inv.updateStatus === "success" ? (
                              <span style={{ color: "#16a34a", fontWeight: "600" }}>Thành công</span>
                            ) : (
                              <span style={{ color: "#dc2626", fontSize: "12px" }} title={inv.updateError}>
                                {inv.updateError || "Lỗi"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {SHOW_TNCN_DELETE && activeTab === "delete-tncn" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>Xoá chứng từ TNCN</h1>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              maxWidth: "700px",
            }}
          >
            <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
              Lấy danh sách chứng từ theo voucherSymbolId (phân trang 300), sau đó xoá từng chứng từ bằng API DELETE. Cần Bearer token và RequestVerificationToken (XSRF) từ phiên đăng nhập TNCN.
            </p>
            <form onSubmit={handleDeleteTncnVouchers}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>
                  Mã số thuế
                </label>
                <input
                  type="text"
                  value={tncnTaxCode}
                  onChange={(e) => setTncnTaxCode(e.target.value)}
                  placeholder="VD: 0313364566"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>
                  Voucher Symbol ID
                </label>
                <input
                  type="text"
                  value={tncnVoucherSymbolId}
                  onChange={(e) => setTncnVoucherSymbolId(e.target.value)}
                  placeholder="VD: 3a1cf7e4-9de3-e97e-8b9f-ba83282dea11"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>
                  Bearer token (Authorization)
                </label>
                <input
                  type="password"
                  value={tncnBearerToken}
                  onChange={(e) => setTncnBearerToken(e.target.value)}
                  placeholder="Bearer eyJhbGci..."
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>
                  RequestVerificationToken (XSRF)
                </label>
                <input
                  type="text"
                  value={tncnRequestVerificationToken}
                  onChange={(e) => setTncnRequestVerificationToken(e.target.value)}
                  placeholder="CfDJ8EiX1iYPse5KlIhd..."
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
                />
              </div>
              {tncnLog.totalFetched > 0 && (
                <div style={{ marginBottom: "12px", fontSize: "13px", color: "#333" }}>
                  Đã lấy: {tncnLog.totalFetched} chứng từ — Xoá thành công: {tncnLog.deleteSuccess}, thất bại: {tncnLog.deleteFail}
                </div>
              )}
              <button
                type="submit"
                disabled={tncnLoading}
                style={{
                  padding: "10px 20px",
                  backgroundColor: tncnLoading ? "#ccc" : "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "14px",
                  cursor: tncnLoading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {tncnLoading ? "Đang xử lý (lấy danh sách + xoá từng bản ghi)..." : "Lấy danh sách và xoá tất cả chứng từ TNCN"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "fill-gap" && (
        <div style={{ padding: "20px" }}>
          <h1 style={{ marginBottom: "20px" }}>Lấp lủng HĐ</h1>
          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
            <p style={{ color: "#666", fontSize: "14px" }}>
              Tính năng đang được phát triển...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
