import React, { useEffect } from "react";

const Support = () => {
  useEffect(() => {
    document.title = "Hỗ trợ kỹ thuật";
  }, []);

  return (
    <div
      style={{
        paddingTop: "7rem",
        backgroundColor: "#EDF1F5",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="gird-layout wide">
        <div className="row">
          <div className="col l-12">
            <div
              className="card"
              style={{
                backgroundColor: "white",
                padding: "2rem",
                textAlign: "center",
              }}
            >
              <h2 style={{ color: "#0069b4", marginBottom: "1rem" }}>
                Hỗ trợ kỹ thuật
              </h2>
              <p style={{ color: "#666" }}>Trang đang được phát triển...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;

