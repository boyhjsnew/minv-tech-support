import * as React from "react";
import { createBrowserRouter, Outlet, RouterProvider, useLocation, useNavigate } from "react-router-dom";

import "primereact/resources/themes/lara-light-cyan/theme.css";

import NavBar from "./components/NavBar";
import { Provider } from "react-redux";
import { store } from "./store/store";

import Dashboard from "./page/Dashboard";
import Breadcrumbs from "./components/Breadcrumbs";
import Autoaccount from "./page/autoaccount/Autoaccount";
import InsertCKS from "./page/upgrade/InsertCKS";
import Customers from "./page/upgrade/Customers";
import "primeicons/primeicons.css";
import "primereact/resources/primereact.min.css"; // core css
import "primeicons/primeicons.css";

import Tax from "./page/Tax";
import Declaration from "./page/upgrade/ Declaration";
import IntrustMultipe from "./page/upgrade/IntrustMultipe";
import DeleteCache from "./page/cache/DeleteCache";
import UpdateMuiltipe from "./page/UpdateMuiltipe";
import Support from "./page/Support";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Danh sách các route cần đăng nhập CRM (trừ trang đăng nhập)
    const routesRequireLogin = [
      "/chuyen-chu-ky-so",
      "/dong-bo-du-lieu",
      "/chu-ky-so-hang-loat",
      "/chuyen-to-khai",
      "/xoa-cache-ky",
      "/update-hoa-don",
    ];

    // Kiểm tra nếu route hiện tại cần đăng nhập CRM
    if (routesRequireLogin.includes(location.pathname)) {
      const storedAccountString = localStorage.getItem("account");
      let isLoggedIn = false;

      if (storedAccountString) {
        try {
          const storedAccount = JSON.parse(storedAccountString);
          if (
            storedAccount &&
            storedAccount.username &&
            storedAccount.password &&
            storedAccount.madvcs
          ) {
            isLoggedIn = true;
          }
        } catch (error) {
          console.error("Error parsing account:", error);
        }
      }

      // Nếu chưa đăng nhập, cảnh báo và chuyển về trang đăng nhập
      if (!isLoggedIn) {
        alert(
          "⚠️ Vui lòng đăng nhập CRM trước!\n\n" +
          "Bạn cần đăng nhập vào CRM để sử dụng tính năng này.\n" +
          "Vui lòng vào trang 'Đăng nhập CRM' để đăng nhập."
        );
        navigate("/tu-dong-dang-nhap");
      }
    }
  }, [location.pathname, navigate]);

  return (
    <>
      <NavBar />
      <Breadcrumbs />
      <Outlet />
    </>
  );
};
const router = createBrowserRouter([
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "/tu-dong-dang-nhap",
        element: <Autoaccount />,
      },
      {
        path: "/tra-cuu",
        element: <Tax />,
      },
      {
        path: "/chuyen-chu-ky-so",
        element: <InsertCKS />,
      },
      {
        path: "/dong-bo-du-lieu",
        element: <Customers />,
      },
      {
        path: "/chuyen-to-khai",
        element: <Declaration />,
      },
      {
        path: "/chu-ky-so-hang-loat",
        element: <IntrustMultipe />,
      },
      {
        path: "/xoa-cache-ky",
        element: <DeleteCache />,
      },
      {
        path: "/update-hoa-don",
        element: <UpdateMuiltipe />,
      },
      {
        path: "/ho-tro-ky-thuat",
        element: <Support />,
      },
    ],
  },
]);
function App() {
  return (
    <Provider store={store}>
      {" "}
      <div className="app">
        <div className="container">
          <RouterProvider router={router} />
        </div>
      </div>
    </Provider>
  );
}

export default App;
