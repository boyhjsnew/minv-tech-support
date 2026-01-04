import React, { useState } from "react";
import { MenuItems } from "./MenuItems";
import "./Dropdown.css";
import { Link, useNavigate } from "react-router-dom";

function Dropdown() {
  const [click, setClick] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => setClick(!click);

  // Danh sách các route cần đăng nhập CRM
  const routesRequireLogin = [
    "/chuyen-chu-ky-so",
    "/dong-bo-du-lieu",
    "/chu-ky-so-hang-loat",
    "/chuyen-to-khai",
  ];

  // Kiểm tra đăng nhập CRM
  const isCRMLoggedIn = () => {
    const storedAccountString = localStorage.getItem("account");
    if (!storedAccountString) {
      return false;
    }
    try {
      const storedAccount = JSON.parse(storedAccountString);
      return (
        storedAccount &&
        storedAccount.username &&
        storedAccount.password &&
        storedAccount.madvcs
      );
    } catch (error) {
      return false;
    }
  };

  // Xử lý click vào link
  const handleLinkClick = (e, path) => {
    // Nếu route cần đăng nhập và chưa đăng nhập
    if (routesRequireLogin.includes(path) && !isCRMLoggedIn()) {
      e.preventDefault(); // Ngăn chặn navigation
      alert(
        "⚠️ Vui lòng đăng nhập CRM trước!\n\n" +
        "Bạn cần đăng nhập vào CRM để sử dụng tính năng này.\n" +
        "Vui lòng vào trang 'Đăng nhập CRM' để đăng nhập."
      );
      navigate("/tu-dong-dang-nhap");
      setClick(false);
      return;
    }
    setClick(false);
  };

  return (
    <>
      <ul
        onClick={handleClick}
        className={click ? "dropdown-menu clicked" : "dropdown-menu"}
      >
        {MenuItems.map((item, index) => {
          return (
            <li key={index}>
              <Link
                className={item.cName}
                to={item.path}
                onClick={(e) => handleLinkClick(e, item.path)}
              >
                <span className={item.icon}></span>
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default Dropdown;
