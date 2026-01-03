import React, { useEffect, useState } from "react";
import { Link, replace } from "react-router-dom";
import "./InsertCKS.scss";

import GetListCKS from "../../Utils/GetCKS";
import ResetPassword from "../../Utils/ResetPassword";
import ResetPasswordNewApp from "../../Utils/ResetPasswordNewApp";
import GetTokenCRM from "../../Utils/GetTokenCRM";
import { toast, ToastContainer } from "react-toastify";
import { styleError, styleSuccess } from "../../components/ToastNotifyStyle";
import Login from "../../Utils/Login";
import ToastNotify from "../../components/ToastNotify";

import { MoonLoader } from "react-spinners";
import inserCKSnewAPP from "../../Utils/InsertCKSNewApp";
import { useDispatch, useSelector } from "react-redux";
import { setTaxCode } from "../../store/taxCodeSlice";

const InsertCKS = () => {
  const dispatch = useDispatch();
  const taxCode = useSelector((state) => state.taxCode.value);
  const [listCKS, setListCKS] = useState([]);
  const [load, setLoad] = useState(false);
  const [stillValid, setStillValid] = useState([]);
  const [account, setAccount] = useState("");
  const [passWord, setPassword] = useState("");

  const [passWord1, setPassword1] = useState("");
  const [cookies, setCokies] = useState("");
  const override = {
    display: "block",
    margin: "0 auto",
    borderColor: "red",
    position: "absolute",
    top: "40%",
    left: "45%",
  };
  // Thay đổi cách set taxCode
  const handleTaxCodeChange = (e) => {
    dispatch(setTaxCode(e.target.value.trim()));
  };

  const mapDataCKS = (data) => {
    return data.map((item) => ({
      vender: item.issuer, // Giá trị mặc định
      subjectName: item.subjectname,
      serialNumber: item.so_serial,
      dateFrom: item.ngaybatdau,
      expireDate: item.ngayketthuc,
      form: 1, // Giá trị mặc định
      tokenType: item.libraryName ? 0 : 1, // Giá trị mặc định
      used: true,
    }));
  };
  const handleGetCKS = async () => {
    const storedAccountString = localStorage.getItem("account");
    const storedAccount = storedAccountString
      ? JSON.parse(storedAccountString)
      : null;

    if (taxCode !== null) {
      try {
        setLoad(true);
        // Bước 1: Lấy token CRM
        const tokenCrmResponse = await GetTokenCRM(
          storedAccount.username,
          storedAccount.password,
          storedAccount.madvcs
        );
        if (!tokenCrmResponse.token) {
          throw new Error("Không thể lấy được token từ CRM");
        }
        const tokenCrm = tokenCrmResponse.token;

        // Bước 2: Reset mật khẩu và lấy token đăng nhập 1.0
        const resetPasswordResponse = await ResetPassword(taxCode, tokenCrm);
        if (!resetPasswordResponse.token) {
          throw new Error("Không thể reset password và lấy token mới");
        }
        setPassword1(resetPasswordResponse.token);

        const openNewWindow = () => {
          window.open(`https://${taxCode.replace("-", "")}.minvoice.com.vn`);
        };

        openNewWindow();

        const newToken = resetPasswordResponse.token;

        //Bước 3 Login 1.0 lấy token
        const tokenOldApp = await Login(taxCode, newToken);
        if (!tokenOldApp) {
          throw new Error("Không thể đăng nhập 1.0");
        }
        const tokenLogin = tokenOldApp.token;
        //Bước 4 Login 2.0 lấy token
        const tokenNewapp = await ResetPasswordNewApp(taxCode, tokenCrm);
        if (!tokenNewapp) {
          throw new Error("Không thể đăng nhập 2.0");
        }
        const accountNewApp = tokenNewapp;
        setAccount(accountNewApp.token.data.account);
        setPassword(accountNewApp.token.data.passWord);

        // Bước 5: Lấy danh sách CKS
        const listCKSResponse = await GetListCKS(taxCode, tokenLogin);
        if (!listCKSResponse.data) {
          toast.error(
            <ToastNotify status={-1} message={"Lỗi khi lấy danh sách CKS"} />,
            { style: styleError }
          );
          setListCKS([]);
          setLoad(false);
          throw new Error("Không thể lấy danh sách CKS");
        }
        toast.success(
          <ToastNotify status={0} message={"Lấy danh sách CKS thành công"} />,
          { style: styleSuccess }
        );

        setLoad(false);

        // Mở trang 2.0 và inject script để tự động lưu cookies
        const newWindow = window.open(
          `https://${taxCode}.minvoice.net/#/`,
          "_blank"
        );

        // Inject script để tự động lưu cookies vào localStorage
        if (newWindow) {
          setTimeout(() => {
            try {
              // Tạo script để lưu cookies
              const script = `
(function() {
  const cookies = document.cookie;
  const storageKey = 'minv_tool_cookies_${taxCode}';
  if (cookies && cookies.length > 0) {
    localStorage.setItem(storageKey, cookies);
    console.log('✅ Đã tự động lưu cookies vào localStorage');
    if (window.opener) {
      window.opener.postMessage({
        type: 'COOKIES_SAVED',
        taxCode: '${taxCode}',
        cookies: cookies
      }, '*');
    }
  }
  
  // Tự động cập nhật khi cookies thay đổi (khi user login)
  const checkCookies = setInterval(() => {
    const currentCookies = document.cookie;
    if (currentCookies && currentCookies.length > 0) {
      localStorage.setItem(storageKey, currentCookies);
      if (window.opener) {
        try {
          window.opener.postMessage({
            type: 'COOKIES_SAVED',
            taxCode: '${taxCode}',
            cookies: currentCookies
          }, '*');
        } catch (e) {}
      }
    }
  }, 2000);
  
  setTimeout(() => clearInterval(checkCookies), 300000);
})();
              `;
              newWindow.eval(script);
            } catch (e) {
              // Cross-origin, không thể inject trực tiếp
              // User cần chạy script thủ công hoặc cookies sẽ được lưu khi có
              console.log(
                "⚠️ Không thể inject script do cross-origin. Cookies sẽ được lưu khi user đăng nhập."
              );
            }
          }, 2000);

          // Lắng nghe message từ window con
          const messageHandler = (event) => {
            if (
              event.data &&
              event.data.type === "COOKIES_SAVED" &&
              event.data.taxCode === taxCode
            ) {
              const cookies = event.data.cookies;
              // Lưu vào localStorage của tool
              localStorage.setItem(`minv_tool_cookies_${taxCode}`, cookies);
              console.log("✅ Đã nhận cookies từ trang 2.0:", cookies);
            }
          };
          window.addEventListener("message", messageHandler);
        }

        // Chuyển đổi dữ liệu theo định dạng mong muốn
        const mappedData = mapDataCKS(listCKSResponse.data.data);
        setListCKS(mappedData);

        // Ở đây bạn có thể làm gì đó với danh sách CKS
      } catch (error) {
        console.error("Đã xảy ra lỗi:", error);
      }
    }
  };
  const handleInsertCKS = async () => {
    if (cookies != null && stillValid.length > 0) {
      try {
        setLoad(true);
        const results = await inserCKSnewAPP(stillValid, taxCode, cookies);

        // Đếm số lượng thành công và thất bại
        const successCount = results.filter((r) => r?.success).length;
        const failCount = results.filter((r) => !r?.success).length;

        if (successCount > 0) {
          toast.success(
            <ToastNotify
              status={0}
              message={`Đã thêm thành công ${successCount} CKS${
                failCount > 0 ? `, thất bại ${failCount}` : ""
              }`}
            />,
            { style: styleSuccess }
          );
        } else {
          toast.error(
            <ToastNotify
              status={-1}
              message={`Thất bại khi thêm CKS. Vui lòng kiểm tra cookies và thử lại.`}
            />,
            { style: styleError }
          );
        }
      } catch (error) {
        console.error("Error inserting CKS:", error);
        toast.error(
          <ToastNotify status={-1} message={`Lỗi: ${error.message}`} />,
          { style: styleError }
        );
      } finally {
        setLoad(false);
      }
    } else {
      toast.warning(
        <ToastNotify
          status={-1}
          message="Vui lòng lấy cookies từ trình duyệt và đảm bảo có CKS còn hạn"
        />,
        { style: styleError }
      );
    }
  };
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);

    toast.success(
      <ToastNotify status={0} message={"Mật khẩu đã được sao chép"} />,
      { style: styleSuccess }
    );
  };

  useEffect(() => {
    const today = new Date(); // Ngày hiện tại

    const listStillValid = listCKS.filter(
      (cks) => new Date(cks.expireDate) >= today
    );
    setStillValid(listStillValid);
    console.log(listStillValid);
  }, [listCKS]);

  useEffect(() => {
    document.title = "Insert CKS";
  }, []);
  useEffect(() => {
    document.title = "Insert CKS";
  }, []);
  return (
    <div className="login-cert">
      <ToastContainer
        autoClose={2000}
        hideProgressBar
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <MoonLoader
        color="red"
        loading={load}
        cssOverride={override}
        size={100}
        aria-label="Loading Spinner"
        data-testid="loader"
      />
      <div className="right-row-cert">
        <div className="form-auth-cert">
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontWeight: 600,
                color: "#0069b4",
                fontSize: "23px",
                marginBottom: "30px",
              }}
            >
              BƯỚC 1: LẤY DANH SÁCH CKS
            </p>
            <img
              src={require("../../assets/cert.png")}
              alt="logo"
              width={"115px"}
              height={"150px"}
            ></img>
          </div>

          <form className="form-login-cert">
            <label className="block mb-2 fz-15 " htmlFor="uname">
              Mã số thuế
            </label>
            <input
              id="username"
              className="input-login "
              type="text"
              name="uname"
              placeholder="0106026495-998"
              style={{ textTransform: "uppercase" }}
              onChange={handleTaxCodeChange}
              value={taxCode || ""}
            />

            <div
              style={{
                height: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            ></div>
            <label
              className="block mb-2 fz-15 "
              style={{ fontWeight: 700, color: "rgb(99, 102, 241)" }}
              htmlFor="uname"
            >
              Login trang 2.0 để tool lấy cookie
            </label>
            <label
              style={{ cursor: "copy" }}
              onClick={() => copyToClipboard(account.trim())}
              className="block mb-2 fz-15 "
              htmlFor="uname"
            >
              Tài khoản: <span style={{ fontWeight: "700" }}>{account}</span>
            </label>
            <label
              onClick={() => copyToClipboard(passWord.trim())}
              className="block mb-2 fz-15 "
              htmlFor="uname"
              style={{ cursor: "copy" }}
            >
              <div>
                Mật khẩu: <span style={{ fontWeight: "700" }}>{passWord}</span>{" "}
                <span
                  style={{ paddingLeft: "10px", color: "gray" }}
                  class="fa-solid fa-copy"
                ></span>
              </div>
            </label>

            {/* <input
              id="username"
              className="input-login mb-3"
              type="text"
              name="uname"
              placeholder="AspNetCore.Culture=c%3Dvi%7Cuic%3Dvi; _ga=GA1.1.1346985074.1695019329; twk_uuid_5b713334afc2c34e96e783c7=%7B%22uuid%22%3A%221.WrtFxV4R2qYGy"
              onChange={(e) => setCokies(e.target.value)}
            /> */}

            <div
              style={{
                height: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            ></div>
            <label
              className="block mb-2 fz-15 "
              style={{ fontWeight: 700, color: "rgb(99, 102, 241)" }}
              htmlFor="uname"
            >
              Tài khoản 1.0
            </label>
            <label
              onClick={() => copyToClipboard("ADMINISTRATOR")}
              className="block mb-2 fz-15 "
              htmlFor="uname"
              style={{ cursor: "copy" }}
            >
              Tài khoản:{" "}
              <span style={{ fontWeight: "700" }}>ADMINISTRATOR</span>
            </label>
            <label
              onClick={() => copyToClipboard(passWord1)}
              className="block mb-2 fz-15 "
              htmlFor="uname"
              style={{ cursor: "copy" }}
            >
              <div>
                Mật khẩu: <span style={{ fontWeight: "700" }}>{passWord1}</span>{" "}
                <span
                  style={{ paddingLeft: "10px", color: "gray" }}
                  class="fa-solid fa-copy"
                  onClick={() => copyToClipboard(passWord1)}
                  className="block mb-2 fz-15 "
                ></span>
              </div>
            </label>
          </form>
          <button
            type="submit"
            className="p-button mt-1 fz-15"
            onClick={handleGetCKS}
          >
            <i class="fa-solid fa-key"></i>
            <Link
              style={{
                flex: 1,
                padding: "0.75rem",
                color: "#fff",
                textDecoration: "none",
              }}
              // to="/dashboard"
            >
              Kích hoạt
            </Link>
          </button>
        </div>
      </div>
      <div className="right-row-cert">
        <div className="form-auth-cert">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <p
              style={{
                fontWeight: 600,
                color: "#0069b4",
                fontSize: "23px",
                marginBottom: "30px",
              }}
            >
              BƯỚC 2: KIỂM TRA THÔNG TIN CHỮ KÝ SỐ
            </p>
          </div>

          <form className="form-login-cert">
            <label className="block mb-2 fz-15 " htmlFor="uname">
              Danh sách chữ ký số
            </label>
            <div
              bac
              style={{
                display: "flex",

                justifyContent: "space-between",
              }}
            >
              <label
                style={{ color: "#6366f1", fontWeight: 700 }}
                className="block mb-2 fz-15 "
                htmlFor="uname"
              >
                Tổng Số lượng: {listCKS && listCKS.length}
              </label>
              <label
                style={{ color: "red", fontWeight: 700 }}
                className="block mb-2 fz-15 "
                htmlFor="uname"
              >
                CKS còn hạn: {listCKS && stillValid.length}
              </label>
            </div>

            <textarea
              id="username"
              className="input-login mb-3 h-[400px] "
              type="text"
              name="uname"
              rows={25}
              cols={40}
              style={{ fontWeight: "500" }}
              value={JSON.stringify(listCKS, null, 2)}
              // onChange={(e) => setListCKS(e.target.value.toUpperCase())}
            />

            <div
              style={{
                height: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            ></div>
          </form>

          <button
            type="submit"
            className="p-button mt-1 fz-15"
            onClick={() => handleInsertCKS(stillValid, taxCode, cookies)}
          >
            <i class="fa-solid fa-key"></i>
            <Link
              style={{
                flex: 1,
                padding: "0.75rem",
                color: "#fff",
                textDecoration: "none",
              }}
              // to="/dashboard"
            >
              Thêm vào 2.0
            </Link>
          </button>
        </div>
      </div>
      {/* <div className="right-row-cert">
        <div className="form-auth-cert">
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontWeight: 600,
                color: "#0069b4",
                fontSize: "23px",
                marginBottom: "30px",
              }}
            >
              BƯỚC 3: KẾT QUẢ VÀ THÊM TASK CRM
            </p>
          </div>

          <form className="form-login-cert">
            <label className="block mb-2 fz-15 " htmlFor="uname">
              Kết quả trả về
            </label>
            <div
              bac
              style={{
                display: "flex",

                justifyContent: "space-between",
              }}
            ></div>

            <textarea
              id="username"
              className="input-login mb-3"
              type="text"
              name="uname"
              rows={25}
              cols={40}
              style={{ fontWeight: "500" }}
              value={JSON.stringify(listCKS, null, 2)}

              //   onChange={(e) => setUsername(e.target.value.toUpperCase())}
            />

            <div
              style={{
                height: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            ></div>
          </form>

          <button
            type="submit"
            className="p-button mt-1 fz-15"
            // onClick={checkLogin}
          >
            <i class="fa-solid fa-key"></i>
            <Link
              style={{
                flex: 1,
                padding: "0.75rem",
                color: "#fff",
                textDecoration: "none",
              }}
              // to="/dashboard"
            >
              Thêm vào 2.0
            </Link>
          </button>
        </div>
      </div> */}
    </div>
  );
};

export default InsertCKS;
