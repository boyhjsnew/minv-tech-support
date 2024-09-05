import * as React from "react";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import NavBar from "./components/NavBar";

import "./App.css";
import Dashboard from "./page/Dashboard";
import Breadcrumbs from "./components/Breadcrumbs";
import Autoaccount from "./page/autoaccount/Autoaccount";
import InsertCKS from "./page/upgrade/InsertCKS";

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
        path: "/chuyen-chu-ky-so",
        element: <InsertCKS />,
      },
    ],
  },
]);
function App() {
  return (
    <div className="app">
      <div className="container">
        <RouterProvider router={router} />
      </div>
    </div>
  );
}

export default App;
