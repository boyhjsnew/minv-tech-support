/* eslint-disable jsx-a11y/alt-text */
import React, { useEffect, useState } from "react";

import { Steps } from "primereact/steps";

import "primereact/resources/themes/lara-light-cyan/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import "./NavBar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
// import ModalMenu from "./ModalMenu";
// import ModalChangePass from "./ModalChangePass";
import Dropdown from "./Dropdown";

const NavBar = () => {
  const [isModalMenu, setIsModalMenu] = useState(false);
  const [click, setClick] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const getLocation = useLocation();
  const navigate = useNavigate();
  const handleClick = () => setClick(!click);
  const closeMobileMenu = () => setClick(false);
  const [user, setUser] = useState("");
  const [openDropdown, setOpenDropdown] = useState(false);

  const onMouseEnter = () => {
    if (window.innerWidth < 960) {
      setDropdown(false);
    } else {
      setDropdown(true);
    }
  };
  useEffect(() => {
    const storedAccount = JSON.parse(localStorage.getItem("account"));
    if (storedAccount) {
      setUser(storedAccount.username);
    }
  }, [user]);

  const onMouseLeave = () => {
    if (window.innerWidth < 960) {
      setDropdown(false);
    } else {
      setDropdown(false);
    }
  };

  return (
    <div
      // layout navbar
      className="layout-navbar"
    >
      <div
        style={{ display: isModalMenu ? "block" : "none" }}
        onClick={() => setIsModalMenu(!isModalMenu)}
        className="overlay-menu"
      ></div>
      {/* logo */}

      <img
        onClick={() => navigate("/")}
        src={require("../assets/minvoice-remove_1.png")}
      ></img>

      {/* navbar list */}
      <div style={{ flex: 6, display: "flex", justifyContent: "center" }}>
        <ul className="ul-list-nav">
          <li
            className={
              getLocation.pathname === "/tu-dong-dang-nhap" ? "active" : ""
            }
            role="none"
            style={{ alignItems: "center" }}
          >
            <Link className="link" to="/tu-dong-dang-nhap">
              <span
                style={{ paddingRight: "5px" }}
                class="fa-solid fa-file-invoice"
              ></span>
              <span>Đăng nhập CRM</span>
            </Link>
          </li>
          {/* <li role="none" style={{ alignItems: "center" }}>
            <Link className="link" to="/customers">
              <span
                style={{ paddingRight: "5px" }}
                className="fa-solid fa-file-export"
              ></span>
              <span>Xuất phiếu thu</span>
            </Link>
          </li> */}
          <li
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            role="none"
            style={{ alignItems: "center" }}
            className={
              getLocation.pathname === "/chuyen-chu-ky-so" ? "active" : ""
            }
          >
            <div onClick={closeMobileMenu} className="link">
              <span
                style={{ paddingRight: "5px", position: "relative" }}
                className="fa-solid fa-right-left"
              ></span>
              <span>
                Hỗ trợ kỹ thuật <i className="fas fa-caret-down" />
              </span>
            </div>
            {dropdown && <Dropdown />}
          </li>
          <li
            role="none"
            style={{ alignItems: "center", position: "relative" }}
            className={getLocation.pathname === "/xoa-cache-ky" ? "active" : ""}
            onMouseEnter={() => setOpenDropdown(true)}
            onMouseLeave={() => setOpenDropdown(false)}
          >
            <Link className="link" to="/xoa-cache-ky">
              <span
                style={{ paddingRight: "5px" }}
                className="fa-solid fa-table-list"
              ></span>
              <span>Xoá cache ký</span>
            </Link>
          </li>

          {/* <li
            role="none"
            style={{ alignItems: "center" }}
            className={getLocation.pathname === "/branchreport" ? "active" : ""}
          >
            <Link className="link" to="/branchreport">
              <span
                style={{ paddingRight: "5px" }}
                class="fa-solid fa-calendar-days"
              ></span>
              <span>Báo cáo chi nhánh</span>
            </Link>
          </li> */}
          {/* <li
            role="none"
            style={{ alignItems: "center" }}
            className={getLocation.pathname === "/systemreport" ? "active" : ""}
          >
            <Link className="link" to="/systemreport">
              <span
                style={{ paddingRight: "5px" }}
                class="fa-solid fa-chart-pie"
              ></span>
              <span>Báo cáo hệ thống</span>
            </Link>
          </li> */}
          {/* <li role="none" style={{ alignItems: "center" }}>
            <Link
              className="link"
              to="/customers"
              style={{ alignItems: "center" }}
            >
              <span
                style={{ paddingRight: "5px" }}
                className="fa-solid fa-bars"
              ></span>
              <span>Danh mục</span>
              <i
                style={{ paddingLeft: "5px" }}
                className="fa-solid fa-angle-down"
              ></i>
            </Link>
          </li> */}
        </ul>
      </div>
      {/* link contact */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          margin: "15px 15px",
        }}
      >
        <span style={{ fontWeight: 700, color: "#6466f1" }}>{user + " !"}</span>
        <i
          onClick={() => setIsModalMenu(!isModalMenu)}
          className=" i-user fa-regular fa-user"
        ></i>
      </div>
    </div>
  );
};
<style type="text/css"></style>;

export default NavBar;
