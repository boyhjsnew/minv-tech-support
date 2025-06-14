import React, { useState } from "react";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import GetTokenCRM from "../../Utils/GetTokenCRM";
import ResetPasswordNewApp from "../../Utils/ResetPasswordNewApp";
import { toast, ToastContainer } from "react-toastify";
import { styleError, styleSuccess } from "../../components/ToastNotifyStyle";
import ToastNotify from "../../components/ToastNotify";

export default function IntrustMultipe() {
  const [value, setValue] = useState("");
  const [accountList, setAccountList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const parseZaloMessage = (message) => {
    // Tách các dòng trong tin nhắn
    const lines = message.split("\n").filter((line) => line.trim());
    const accounts = [];
    let currentAccount = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes("Tên đăng nhập:")) {
        // Nếu đã có account trước đó, thêm vào danh sách
        if (currentAccount) {
          accounts.push(currentAccount);
        }

        // Tạo account mới
        const username = line.split(":")[1].trim();
        const taxCode = username.replace("ICA.", "");

        currentAccount = {
          taxCode: taxCode,
          loginInfo: {
            username: username,
            password: "",
          },
          certInfo: {
            username: username,
            pin: "123456", // Mã PIN mặc định
            password: "123456", // Mật khẩu mặc định
          },
        };
      } else if (line.includes("Mật khẩu:") && currentAccount) {
        currentAccount.loginInfo.password = line.split(":")[1].trim();
        currentAccount.certInfo.pin = line.split(":")[1].trim();
      }
    }

    // Thêm account cuối cùng nếu có
    if (currentAccount) {
      accounts.push(currentAccount);
    }

    return accounts;
  };

  const handleTextareaChange = async (e) => {
    const message = e.target.value;
    if (message.trim()) {
      const accounts = parseZaloMessage(message);
      setAccountList(accounts);

      // Tự động lấy tài khoản cho từng mã số thuế
      setIsLoading(true);
      try {
        const storedAccountString = localStorage.getItem("account");
        const storedAccount = storedAccountString
          ? JSON.parse(storedAccountString)
          : null;

        if (!storedAccount) {
          toast.error(
            <ToastNotify status={-1} message={"Vui lòng đăng nhập trước"} />,
            { style: styleError }
          );
          return;
        }

        // Lấy token CRM
        const tokenCrmResponse = await GetTokenCRM(
          storedAccount.username,
          storedAccount.password,
          storedAccount.madvcs
        );

        if (!tokenCrmResponse.token) {
          throw new Error("Không thể lấy được token từ CRM");
        }

        // Lấy tài khoản cho từng mã số thuế
        for (const account of accounts) {
          try {
            const tokenNewapp = await ResetPasswordNewApp(
              account.taxCode,
              tokenCrmResponse.token
            );
            if (tokenNewapp && tokenNewapp.token && tokenNewapp.token.data) {
              account.loginInfo.username = tokenNewapp.token.data.account;
              account.loginInfo.password = tokenNewapp.token.data.passWord;

              // Mở link cho từng mã số thuế
              window.open(`https://${account.taxCode}.minvoice.net/#/`);
            }
          } catch (error) {
            console.error(
              `Lỗi khi lấy tài khoản cho ${account.taxCode}:`,
              error
            );
            toast.error(
              <ToastNotify
                status={-1}
                message={`Lỗi khi lấy tài khoản cho ${account.taxCode}`}
              />,
              { style: styleError }
            );
          }
        }

        setAccountList([...accounts]);
        toast.success(
          <ToastNotify status={0} message={"Đã lấy tài khoản thành công"} />,
          { style: styleSuccess }
        );
      } catch (error) {
        console.error("Đã xảy ra lỗi:", error);
        toast.error(
          <ToastNotify status={-1} message={"Lỗi khi lấy tài khoản"} />,
          { style: styleError }
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      setAccountList([]);
    }
  };

  const updateCKSStatus = async (taxCode, cksId, cksData) => {
    try {
      console.log("Dữ liệu gửi đi:", {
        taxCode,
        cksId,
        cksData,
      });

      const response = await fetch(
        `https://${taxCode}.minvoice.net/api/api/app/token/${cksId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          withCredentials: true,
          body: JSON.stringify({
            vender: cksData.vender,
            subjectName: cksData.subjectName,
            serialNumber: cksData.serialNumber,
            dateFrom: cksData.dateFrom,
            expireDate: cksData.expireDate,
            form: cksData.form,
            tokenType: cksData.tokenType,
            used: true,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      // Không cần parse JSON vì API không trả về gì
      console.log(`Cập nhật trạng thái CKS thành công cho ${taxCode}`);
      return true;
    } catch (error) {
      console.error(`Lỗi khi cập nhật trạng thái CKS cho ${taxCode}:`, error);
      throw error;
    }
  };

  const insertMultipleCKS = async (accounts) => {
    setIsLoading(true);
    try {
      for (const account of accounts) {
        try {
          console.log("Bắt đầu thêm CKS cho:", account.taxCode);

          // Thêm CKS
          const response = await fetch(
            `https://${account.taxCode}.minvoice.net/api/api/app/token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              withCredentials: true,
              body: JSON.stringify({
                user: account.certInfo.username,
                passwordCer: account.certInfo.password,
                pin: account.certInfo.pin,
                inputChange: "pin",
                tokenType: 5,
                used: true,
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Response error:", {
              status: response.status,
              statusText: response.statusText,
              errorText,
            });
            throw new Error(
              `HTTP error! status: ${response.status}, message: ${errorText}`
            );
          }

          // Kiểm tra content type trước khi parse JSON
          const contentType = response.headers.get("content-type");
          let cksData;

          if (contentType && contentType.includes("application/json")) {
            cksData = await response.json();
          } else {
            const text = await response.text();
            console.log("Response text:", text);
            // Nếu response là rỗng hoặc không phải JSON, tạo một object mặc định
            cksData = { id: null, message: text || "Thêm CKS thành công" };
          }

          console.log(`Thêm CKS thành công cho ${account.taxCode}:`, cksData);

          // Cập nhật trạng thái sử dụng
          if (cksData && cksData.id) {
            console.log("Bắt đầu cập nhật trạng thái cho:", account.taxCode);
            await updateCKSStatus(account.taxCode, cksData.id, cksData);
            toast.success(
              <ToastNotify
                status={0}
                message={`Thêm và cập nhật CKS thành công cho ${account.taxCode}`}
              />,
              { style: styleSuccess }
            );
          } else {
            console.warn("Không có ID CKS để cập nhật cho:", account.taxCode);
            toast.success(
              <ToastNotify
                status={0}
                message={`Thêm CKS thành công cho ${account.taxCode}`}
              />,
              { style: styleSuccess }
            );
          }
        } catch (error) {
          console.error(`Lỗi chi tiết khi thêm CKS cho ${account.taxCode}:`, {
            error: error.message,
            stack: error.stack,
          });
          toast.error(
            <ToastNotify
              status={-1}
              message={`Lỗi khi thêm CKS cho ${account.taxCode}: ${error.message}`}
            />,
            { style: styleError }
          );
        }
      }
    } catch (error) {
      console.error("Đã xảy ra lỗi:", error);
      toast.error(
        <ToastNotify
          status={-1}
          message={`Lỗi khi thêm CKS: ${error.message}`}
        />,
        { style: styleError }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "2rem",
        margin: "0 auto",
      }}
    >
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

      {/* Header Section */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "2rem",
        }}
      >
        <p
          style={{
            fontWeight: 600,
            color: "#0069b4",
            fontSize: "23px",
            marginBottom: "30px",
          }}
        >
          Thêm chữ ký số IntrustCA hàng loạt
        </p>
      </div>

      {/* Form Section */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "1.5rem",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
          margin: "0 auto 2rem auto",
        }}
      >
        <textarea
          id="zaloMessages"
          name="zaloMessages"
          placeholder="Dán nội dung tin nhắn Zalo vào đây..."
          onChange={handleTextareaChange}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "4px",
            border: "1px solid #ddd",
            minHeight: "20px",
            resize: "vertical",
            fontFamily: "monospace",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        />
      </div>

      {/* List thông tin tk + cks*/}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "1rem",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "rgb(99, 102, 241)",
            marginBottom: "1rem",
          }}
        >
          Danh sách thông tin tài khoản
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
            padding: "0.5rem 0",
          }}
        >
          {accountList.map((account, index) => (
            <div
              key={index}
              style={{
                padding: "0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                backgroundColor: "#f9fafb",
                fontSize: "13px",
              }}
            >
              {/* Mã số thuế */}
              <div
                style={{
                  marginBottom: "0.5rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ fontWeight: 600 }}>MST: </span>
                <span>{account.taxCode}</span>
              </div>

              {/* Thông tin đăng nhập */}
              <div
                style={{
                  marginBottom: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "#0069b4",
                    marginBottom: "0.25rem",
                    fontSize: "12px",
                  }}
                >
                  Thông tin đăng nhập
                </div>

                <div style={{ marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600 }}>TK: </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {account.loginInfo.username}
                    <i
                      className="fa-solid fa-copy"
                      style={{
                        color: "gray",
                        cursor: "pointer",
                        fontSize: "12px",
                        flexShrink: 0,
                      }}
                      onClick={() =>
                        copyToClipboard(
                          account.loginInfo.username +
                            " " +
                            account.loginInfo.password
                        )
                      }
                    ></i>
                  </span>
                </div>

                <div>
                  <span style={{ fontWeight: 600 }}>MK: </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {account.loginInfo.password}
                  </span>
                </div>
              </div>

              {/* Thông tin chữ ký số */}
              <div
                style={{
                  padding: "0.5rem",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "#0069b4",
                    marginBottom: "0.25rem",
                    fontSize: "12px",
                  }}
                >
                  Thông tin chữ ký số
                </div>

                <div style={{ marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600 }}>TK: </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {account.certInfo.username}
                  </span>
                </div>

                <div style={{ marginBottom: "0.25rem" }}>
                  <span style={{ fontWeight: 600 }}>PIN: </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {account.certInfo.pin}
                  </span>
                </div>

                <div>
                  <span style={{ fontWeight: 600 }}>MK: </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {account.certInfo.password}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Button Section */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
        }}
      >
        <button
          type="submit"
          style={{
            backgroundColor: "#0069b4",
            color: "white",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            minWidth: "200px",
            justifyContent: "center",
          }}
          onClick={() => insertMultipleCKS(accountList)}
          disabled={isLoading || accountList.length === 0}
        >
          <i className="fa-solid fa-key"></i>
          <span
            style={{
              color: "#fff",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Thêm chữ ký số hàng loạt
          </span>
        </button>
      </div>
    </div>
  );
}
