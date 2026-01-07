import React, { useState } from "react";
import { Button } from "primereact/button";
import GetTokenCRM from "../../Utils/GetTokenCRM";
import ResetPasswordNewApp from "../../Utils/ResetPasswordNewApp";
import { toast, ToastContainer } from "react-toastify";
import { styleError, styleSuccess } from "../../components/ToastNotifyStyle";
import ToastNotify from "../../components/ToastNotify";
import axios from "axios";

export default function IntrustMultipe() {
  const [accountList, setAccountList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState({});

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const parseZaloMessage = (message) => {
    // Tách các dòng trong tin nhắn và lọc bỏ dòng trống
    const lines = message.split("\n").filter((line) => line.trim());
    const accounts = [];
    let currentUsername = null;
    let currentPassword = null;

    // Duyệt qua từng dòng và tách các phần bằng khoảng trắng
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Tách dòng thành các phần bằng khoảng trắng (có thể có nhiều khoảng trắng)
      const parts = line.split(/\s+/).filter((part) => part.trim());

      for (const part of parts) {
        const trimmedPart = part.trim();

        // Kiểm tra nếu phần này là username (bắt đầu bằng "ICA.")
        if (trimmedPart.startsWith("ICA.")) {
          // Nếu đã có username và password trước đó, lưu account đó
          if (currentUsername && currentPassword !== null) {
            const taxCode = currentUsername.replace("ICA.", "");
            accounts.push({
              taxCode: taxCode,
              loginInfo: {
                username: currentUsername,
                password: "",
              },
              certInfo: {
                username: currentUsername,
                passwordCer: currentPassword,
                pin: "123456",
              },
            });
          }

          // Bắt đầu account mới
          currentUsername = trimmedPart;
          currentPassword = null; // Reset password, chờ password tiếp theo
        } else if (currentUsername) {
          // Nếu đã có username và phần này không phải username, thì đây là password
          if (currentPassword === null) {
            currentPassword = trimmedPart;
          } else {
            // Nếu đã có password rồi mà vẫn có phần tiếp theo, có thể là username tiếp theo
            // Lưu account hiện tại trước
            const taxCode = currentUsername.replace("ICA.", "");
            accounts.push({
              taxCode: taxCode,
              loginInfo: {
                username: currentUsername,
                password: "",
              },
              certInfo: {
                username: currentUsername,
                passwordCer: currentPassword,
                pin: "123456",
              },
            });

            // Bắt đầu account mới nếu phần này là username
            if (trimmedPart.startsWith("ICA.")) {
              currentUsername = trimmedPart;
              currentPassword = null;
            } else {
              // Nếu không phải username, reset
              currentUsername = null;
              currentPassword = null;
            }
          }
        }
      }
    }

    // Lưu account cuối cùng nếu có
    if (currentUsername && currentPassword !== null) {
      const taxCode = currentUsername.replace("ICA.", "");
      accounts.push({
        taxCode: taxCode,
        loginInfo: {
          username: currentUsername,
          password: "",
        },
        certInfo: {
          username: currentUsername,
          passwordCer: currentPassword,
          pin: "123456",
        },
      });
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
      const baseUrl = `https://${taxCode}.minvoice.net`;

      await axios.put(
        `${baseUrl}/api/api/app/token/${cksId}`,
        {
          vender: cksData.vender,
          subjectName: cksData.subjectName,
          serialNumber: cksData.serialNumber,
          dateFrom: cksData.dateFrom,
          expireDate: cksData.expireDate,
          form: cksData.form,
          tokenType: cksData.tokenType,
          used: true,
        },
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            Referer: `${baseUrl}/`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "sec-ch-ua":
              '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
          },
          withCredentials: true,
        }
      );

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

          const baseUrl = `https://${account.taxCode}.minvoice.net`;

          // Thêm CKS theo curl command
          const response = await axios.post(
            `${baseUrl}/api/api/app/token`,
            {
              user: account.certInfo.username,
              passwordCer: account.certInfo.passwordCer,
              pin: account.certInfo.pin,
              inputChange: "pin",
              tokenType: 5,
            },
            {
              headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json",
                Referer: `${baseUrl}/`,
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                "sec-ch-ua":
                  '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
              },
              withCredentials: true,
            }
          );

          const cksData = response.data;
          console.log(`Thêm CKS thành công cho ${account.taxCode}:`, cksData);

          // Cập nhật trạng thái sử dụng nếu có ID
          if (cksData && cksData.id) {
            console.log("Bắt đầu cập nhật trạng thái cho:", account.taxCode);
            await updateCKSStatus(account.taxCode, cksData.id, cksData);
            setAccountStatus((prev) => ({
              ...prev,
              [account.taxCode]: {
                status: "success",
                message: "Thêm và cập nhật CKS thành công",
              },
            }));
            toast.success(
              <ToastNotify
                status={0}
                message={`Thêm và cập nhật CKS thành công cho ${account.taxCode}`}
              />,
              { style: styleSuccess }
            );
          } else {
            console.warn("Không có ID CKS để cập nhật cho:", account.taxCode);
            setAccountStatus((prev) => ({
              ...prev,
              [account.taxCode]: {
                status: "success",
                message: "Thêm CKS thành công",
              },
            }));
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
            response: error.response?.data,
          });
          const errorMessage =
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            error.message ||
            "Lỗi không xác định";
          setAccountStatus((prev) => ({
            ...prev,
            [account.taxCode]: { status: "error", message: errorMessage },
          }));
          toast.error(
            <ToastNotify
              status={-1}
              message={`Lỗi khi thêm CKS cho ${account.taxCode}: ${errorMessage}`}
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
            marginBottom: "10px",
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
                backgroundColor:
                  accountStatus[account.taxCode]?.status === "success"
                    ? "#f0fdf4" // Màu xanh nhạt cho thành công
                    : accountStatus[account.taxCode]?.status === "error"
                    ? "#fef2f2" // Màu đỏ nhạt cho lỗi
                    : "#f9fafb", // Màu mặc định
                fontSize: "13px",
                position: "relative",
              }}
            >
              {/* Hiển thị trạng thái */}
              {accountStatus[account.taxCode] && (
                <div
                  style={{
                    position: "absolute",
                    top: "0.5rem",
                    right: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "12px",
                    backgroundColor:
                      accountStatus[account.taxCode].status === "success"
                        ? "#dcfce7" // Màu xanh cho thành công
                        : "#fee2e2", // Màu đỏ cho lỗi
                    color:
                      accountStatus[account.taxCode].status === "success"
                        ? "#166534" // Màu chữ xanh đậm
                        : "#991b1b", // Màu chữ đỏ đậm
                  }}
                >
                  {accountStatus[account.taxCode].status === "success"
                    ? "✓ Thành công"
                    : "✕ Lỗi"}
                </div>
              )}

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
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {account.taxCode}
                  <i
                    className="fa-solid fa-copy"
                    style={{
                      color: "gray",
                      cursor: "pointer",
                      fontSize: "12px",
                      flexShrink: 0,
                    }}
                    onClick={() => copyToClipboard(account.taxCode)}
                  ></i>
                </span>
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
                    {account.certInfo.passwordCer}
                  </span>
                </div>
              </div>

              {/* Hiển thị thông báo lỗi nếu có */}
              {accountStatus[account.taxCode]?.status === "error" && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.5rem",
                    backgroundColor: "#fee2e2",
                    borderRadius: "4px",
                    color: "#991b1b",
                    fontSize: "12px",
                  }}
                >
                  {accountStatus[account.taxCode].message}
                </div>
              )}
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
        <Button
          style={{
            padding: "0.5rem 1.5rem",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 3,
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
        </Button>
      </div>
    </div>
  );
}
