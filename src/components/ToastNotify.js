import React from "react";

const ToastNotify = (props) => {
  const { status, message } = props;
  return (
    <div style={{ padding: "0 15px" }}>
      <div
        style={{
          color: status === -1 ? "#FF6869" : "#3DB189",
          fontWeight: "650",
          fontSize: "13px",
          paddingBottom: "5px",
        }}
      >
        {status === -1 ? "Có lỗi xảy ra" : "Thành công"}
      </div>
      <div
        style={{
          color: status === -1 ? "#FF6869" : "#3DB189",
          fontSize: "13px",
          fontWeight: "400",
        }}
      >
        {message}
      </div>
    </div>
  );
};

export default ToastNotify;
