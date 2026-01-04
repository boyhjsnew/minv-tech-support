import React, { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import "./Autoaccount.scss";
import axios from "axios";
import "react-toastify/dist/ReactToastify.css";
import GetTokenCRM from "../../Utils/GetTokenCRM";
import { ToastContainer, toast } from "react-toastify";
import { styleSuccess, styleError } from "../../components/ToastNotifyStyle";
import ToastNotify from "../../components/ToastNotify";
import { detectOS, getChromeDevModeCommand, isChrome } from "../../Utils/ChromeDevModeDetector";

const Autoaccount = () => {
  //   const dispatch = useDispatch();
  const [isCheck, setIsCheck] = useState(false);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [password, setPassword] = useState(null);
  const [madvcs, setMadvcs] = useState("VP");
  const [os, setOs] = useState("unknown");
  const [chromeCommand, setChromeCommand] = useState("");
  axios.defaults.withCredentials = true;

  const handleTokenCRM = async (username, password, madvcs) => {
    const result = await GetTokenCRM(username, password, madvcs);
    setToken(result.token);
  };

  useEffect(() => {
    document.title = "Login CRM";
    
    // Detect OS và tạo lệnh Chrome Dev Mode
    const detectedOS = detectOS();
    setOs(detectedOS);
    
    if (isChrome() && (detectedOS === "macos" || detectedOS === "windows")) {
      const currentUrl = window.location.href;
      const command = getChromeDevModeCommand(detectedOS, currentUrl);
      setChromeCommand(command);
    }
  }, []);
  useEffect(() => {
    if (token) {
      localStorage.setItem(
        "account",
        JSON.stringify({ username, password, madvcs })
      );
      toast.success(
        <ToastNotify status={0} message={"Đăng nhập thành công"} />,
        { style: styleSuccess }
      );
    }
  }, [token]);

  axios.defaults.withCredentials = true;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (username !== "" && password !== "") {
      handleTokenCRM(username, password, madvcs);
    } else {
      toast.error(
        <ToastNotify
          status={-1}
          message={"Tài khoản hoặc mật khẩu không đươc trống !"}
        />,
        {
          style: styleError,
        }
      );
    }
  };

  const copyChromeCommand = () => {
    if (chromeCommand) {
      navigator.clipboard.writeText(chromeCommand);
      toast.success(
        <ToastNotify status={0} message={"Đã copy lệnh vào clipboard!"} />,
        { style: styleSuccess }
      );
    }
  };

  return (
    <div className="login">
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
      <div className="left-row"></div>
      <div className="right-row">
        <div className="form-auth">
          <div className="flex flex-col item-center items-center">
            <img
              src={require("../../assets/logo-minvoice.png")}
              alt="logo"
              width={"164px"}
              height={"115px"}
            ></img>
            <p
              style={{
                fontWeight: 500,
                color: "#99321E",
                fontSize: "23px",
                marginBottom: "30px",
              }}
            >
              Đăng nhập tài khoản CRM
            </p>
          </div>

          <form className="form-login">
            <label className="block  mb-2 fz-15" htmlFor="uname">
              Mã đại lý
            </label>
            <div>
              <select
                className="option block mb-3"
                id="unitbase"
                onChange={(e) => setMadvcs(e.target.value)}
              >
                <option className="option" value={"VP"}>
                  {"VP"}
                </option>
                <option className="option" value={"DL_HCM"}>
                  {"DL_HCM"}
                </option>
              </select>
            </div>
            <label className="block mb-2 fz-15 " htmlFor="uname">
              Tên truy cập
            </label>
            <input
              id="username"
              className="input-login mb-3"
              type="text"
              name="uname"
              // value={username && username}
              checked={true}
              style={{ textTransform: "uppercase" }}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
            />
            <label className="block  lbl-text mb-2 fz-15" htmlFor="uname">
              Mật khẩu
            </label>
            <div style={{}}>
              <input
                id="password"
                className="input-login mb-3"
                type={isCheck ? "text" : "password"}
                // value={password}
                name="pwrd"
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* them easye passs */}
            </div>
            <div
              style={{
                height: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                {/* quen mat khau */}
                <div>
                  <form
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      onClick={() => setIsCheck(!isCheck)}
                      type="checkbox"
                      id="cb-mind"
                      name="mindAcc"
                      className="checkbox-input"
                    />
                    <label
                      className="lbl-checkbox fz-15"
                      style={{ padding: "8px" }}
                      htmlFor="cb-mind"
                    >
                      Hiện mật khẩu
                    </label>
                  </form>
                </div>
              </div>
              {/* <Link>
                <span
                  style={{
                    color: "#3b82f6",
                    cursor: "pointer",
                    fontWeight: "500",
                    fontSize: "15px",
                  }}
                >
                  Quên mật khẩu?
                </span>
              </Link> */}
            </div>
          </form>
          
          {/* Hiển thị lệnh Chrome Dev Mode nếu là Chrome trên macOS hoặc Windows */}
          {isChrome() && (os === "macos" || os === "windows") && chromeCommand && (
            <div
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #0ea5e9",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
                marginTop: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <label
                  className="block mb-2 fz-15"
                  style={{
                    fontWeight: 600,
                    color: "#0c4a6e",
                    margin: 0,
                  }}
                >
                  <i className="fa-brands fa-chrome" style={{ marginRight: "8px" }}></i>
                  Mở Chrome Dev Mode ({os === "macos" ? "macOS" : "Windows"})
                </label>
                <button
                  onClick={copyChromeCommand}
                  style={{
                    backgroundColor: "#0ea5e9",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <i className="fa-regular fa-copy"></i>
                  Copy
                </button>
              </div>
              <div
                style={{
                  backgroundColor: "#1e293b",
                  color: "#e2e8f0",
                  padding: "0.75rem",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  wordBreak: "break-all",
                  overflowX: "auto",
                }}
              >
                {chromeCommand}
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  marginTop: "0.5rem",
                  marginBottom: 0,
                }}
              >
                Chạy lệnh trên trong Terminal (macOS) hoặc Command Prompt (Windows)
              </p>
            </div>
          )}

          <button
            type="submit"
            className="p-button mt-2 fz-15"
            onClick={handleSubmit}
          >
            <i class="fa-regular fa-user"></i>
            <Link
              style={{
                flex: 1,
                padding: "0.75rem",
                color: "#fff",
                textDecoration: "none",
              }}
              // to="/dashboard"
            >
              Đăng nhập
            </Link>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Autoaccount;
