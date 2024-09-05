import React, { useEffect, useState } from "react";
import "./dashboard.scss";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Tổng quan";
  });

  return (
    <div
      style={{
        paddingTop: "7rem",
        backgroundColor: "#EDF1F5",
        display: "flex",
      }}
    >
      <div className="gird-layout wide">
        <div className="row">
          {/* panel item */}
          <div className="col l-2 m-2">
            <a href="#" style={{ textDecoration: "none" }}>
              <div
                className="card row"
                style={{
                  background:
                    "linear-gradient(to right, rgb(231, 121, 238) 0%, rgb(143, 105, 229) 100%)",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <div className="text-align col l-3">
                  <i
                    class="fa fa-house"
                    style={{
                      color: "rgba(255, 255, 255, 0.17)",
                      fontSize: "40px",
                    }}
                  ></i>
                </div>
                <div className="col l-9 mb-1">
                  <div
                    className="mb-1"
                    style={{
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    chi nhánh
                  </div>
                  <div
                    className="mb-1 "
                    style={{
                      color: "white",
                      fontSize: "22px",
                      display: "block",
                    }}
                  >
                    {1}
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* panel item */}
          {/* panel item */}
          <div className="col l-2 m-2   " style={{}}>
            <a href="#" style={{ textDecoration: "none" }}>
              <div
                className="card row"
                style={{
                  background:
                    "linear-gradient(to right, rgb(87, 160, 224) 0%, rgb(126, 135, 235) 100%)",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <div className="text-align col l-3">
                  <i
                    class="fa-solid fa-file"
                    style={{
                      color: "rgba(255, 255, 255, 0.17)",
                      fontSize: "40px",
                    }}
                  ></i>
                </div>
                <div className="col l-9 mb-1">
                  <div
                    className="mb-1"
                    style={{
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    Loại dịch vụ
                  </div>
                  <div
                    className="mb-1 "
                    style={{
                      color: "white",
                      fontSize: "22px",
                      display: "block",
                    }}
                  >
                    2
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* panel item */}
          {/* panel item */}
          <div className="col l-2 m-2   " style={{}}>
            <a href="#" style={{ textDecoration: "none" }}>
              <div
                className="card row"
                style={{
                  background:
                    "linear-gradient(to right, rgb(47, 202, 196) 0%, rgb(16, 171, 204) 100%)",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <div className="text-align col l-3">
                  <i
                    className="fa-solid fa-receipt"
                    style={{
                      color: "rgba(255, 255, 255, 0.17)",
                      fontSize: "40px",
                    }}
                  ></i>
                </div>
                <div className="col l-9 mb-1">
                  <div
                    className="mb-1"
                    style={{
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    phiếu thu
                    <br />
                    hôm nay
                  </div>
                  <div
                    className="mb-1 "
                    style={{
                      color: "white",
                      fontSize: "22px",
                      display: "block",
                    }}
                  >
                    2
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* panel item */}
          {/* panel item */}
          <div className="col l-2 m-2   " style={{}}>
            <a href="#" style={{ textDecoration: "none" }}>
              <div
                className="card row"
                style={{
                  background:
                    "linear-gradient(to right, rgb(247, 169, 161) 0%, rgb(255, 92, 76) 100%)",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <div className="text-align col l-3">
                  <i
                    className="fa-solid fa-file-invoice"
                    style={{
                      color: "rgba(255, 255, 255, 0.17)",
                      fontSize: "40px",
                    }}
                  ></i>
                </div>
                <div className="col l-9 mb-1">
                  <div
                    className="mb-1"
                    style={{
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    phiếu thu
                    <br />
                    hôm qua
                  </div>
                  <div
                    className="mb-1 "
                    style={{
                      color: "white",
                      fontSize: "22px",
                      display: "block",
                    }}
                  >
                    10
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* panel item */}
          {/* panel item */}
          <div className="col l-2 m-2" style={{}}>
            <a href="#" style={{ textDecoration: "none" }}>
              <div
                className="card row"
                style={{
                  background:
                    "linear-gradient(to right, rgb(255, 105, 180) 0%, rgb(255, 20, 147) 100%)",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <div className="text-align col l-3">
                  <i
                    className="fa-solid fa-calendar-plus"
                    style={{
                      color: "rgba(255, 255, 255, 0.17)",
                      fontSize: "40px",
                    }}
                  ></i>
                </div>
                <div className="col l-9 mb-1">
                  <div
                    className="mb-1"
                    style={{
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    tổng phiếu thu
                  </div>
                  <div
                    className="mb-1 "
                    style={{
                      color: "white",
                      fontSize: "22px",
                      display: "block",
                    }}
                  >
                    10
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* panel item */}
          {/* panel item */}
          <div className="col l-2 m-2   " style={{}}>
            <a href="#" style={{ textDecoration: "none" }}>
              <div
                className="card row"
                style={{
                  background:
                    "linear-gradient(to right, rgb(255, 215, 0) 0%, rgb(255, 140, 0) 100%)",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <div className="text-align col l-3">
                  <i
                    className="fa-solid fa-chart-simple"
                    style={{
                      color: "rgba(255, 255, 255, 0.17)",
                      fontSize: "40px",
                    }}
                  ></i>
                </div>
                <div className="col l-9 mb-1">
                  <div
                    className="mb-1"
                    style={{
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    Báo cáo
                  </div>
                  <div
                    className="mb-1 "
                    style={{
                      color: "white",
                      fontSize: "22px",
                      display: "block",
                    }}
                  >
                    2
                  </div>
                </div>
              </div>
            </a>
          </div>
          {/* panel item */}
          {/* table layout item */}
          <div className="col l-6">
            <div
              className="card row"
              style={{
                height: "100%",
                backgroundColor: "white",
                padding: "1rem",
              }}
            >
              <div style={{ fontSize: "12.5px" }}>
                <span
                  className="fa-solid fa-star"
                  style={{
                    color: "#FF892A",
                    fontSize: "13px",
                    paddingRight: "3px",
                  }}
                ></span>
                <span style={{ color: "blue", fontWeight: "bold" }}>
                  Theo dõi hoàn trả tạm ứng
                </span>
              </div>
            </div>
          </div>
          {/* table layout item */}
          {/* table layout item */}
          <div className="col l-6">
            <div
              className="card row"
              style={{
                height: "100%",
                backgroundColor: "white",
                padding: "1rem",
              }}
            >
              <div style={{ fontSize: "12.5px" }}>
                <span
                  className="fa-solid fa-newspaper"
                  style={{
                    color: "#FF892A",
                    fontSize: "13px",
                    paddingRight: "3px",
                  }}
                ></span>
                <span style={{ color: "blue", fontWeight: "bold" }}>
                  Thông báo
                </span>
              </div>
            </div>
          </div>
          {/* table layout item */}
          {/* footer */}
          {/* <div
            className="col l-12"
            style={{
              paddingLeft: "-10px",
              paddingRight: "-10px",
              height: "0",
              maxHeight: "200px",
            }}
          >
            <img
              src={require("../assets/footer.jpeg")}
              style={{
                width: "100%",
              }}
            ></img>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
