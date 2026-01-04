/**
 * Utility để kiểm tra đăng nhập CRM
 */

/**
 * Kiểm tra xem user đã đăng nhập CRM chưa
 * @returns {boolean} - true nếu đã đăng nhập
 */
export const isCRMLoggedIn = () => {
  const storedAccountString = localStorage.getItem("account");
  if (!storedAccountString) {
    return false;
  }

  try {
    const storedAccount = JSON.parse(storedAccountString);
    // Kiểm tra có đủ thông tin không
    if (
      storedAccount &&
      storedAccount.username &&
      storedAccount.password &&
      storedAccount.madvcs
    ) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error parsing account from localStorage:", error);
    return false;
  }
};

/**
 * Kiểm tra và hiển thị thông báo nếu chưa đăng nhập
 * @returns {boolean} - true nếu đã đăng nhập, false nếu chưa
 */
export const checkCRMLogin = () => {
  const isLoggedIn = isCRMLoggedIn();
  
  if (!isLoggedIn) {
    alert(
      "⚠️ Vui lòng đăng nhập CRM trước!\n\n" +
      "Bạn cần đăng nhập vào CRM để sử dụng tính năng này.\n" +
      "Vui lòng vào trang 'Đăng nhập CRM' để đăng nhập."
    );
    return false;
  }
  
  return true;
};

