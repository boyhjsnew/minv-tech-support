import * as React from "react";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

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
