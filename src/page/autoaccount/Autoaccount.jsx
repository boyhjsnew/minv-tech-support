import React, { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import "./Autoaccount.scss";
import axios from "axios";
import "react-toastify/dist/ReactToastify.css";
import GetTokenCRM from "../../Utils/GetTokenCRM";
import { ToastContainer, toast } from "react-toastify";
import { styleSuccess, styleError } from "../../components/ToastNotifyStyle";
import ToastNotify from "../../components/ToastNotify";

const Autoaccount = () => {
  //   const dispatch = useDispatch();
  const [isCheck, setIsCheck] = useState(false);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [password, setPassword] = useState(null);
  const [madvcs, setMadvcs] = useState("VP");
  axios.defaults.withCredentials = true;

  const handleTokenCRM = async (username, password, madvcs) => {
    const result = await GetTokenCRM(username, password, madvcs);
    setToken(result.token);
  };

  useEffect(() => {
    document.title = "Login CRM";
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
          <div style={{ textAlign: "center" }}>
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
