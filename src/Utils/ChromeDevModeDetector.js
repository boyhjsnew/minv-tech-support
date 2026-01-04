/**
 * Utility để detect Chrome Dev Mode và hiển thị cảnh báo
 */

/**
 * Detect OS từ user agent
 * @returns {string} - 'windows', 'macos', 'linux', hoặc 'unknown'
 */
export const detectOS = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes("win")) {
    return "windows";
  } else if (userAgent.includes("mac")) {
    return "macos";
  } else if (userAgent.includes("linux")) {
    return "linux";
  } else {
    return "unknown";
  }
};

/**
 * Lấy lệnh để mở Chrome Dev Mode dựa trên OS
 * @param {string} os - 'windows', 'macos', 'linux'
 * @param {string} url - URL để mở (optional)
 * @returns {string} - Lệnh để chạy
 */
export const getChromeDevModeCommand = (os, url = "") => {
  const urlPart = url ? ` ${url}` : "";
  
  switch (os) {
    case "windows":
      return `start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --new-window --user-data-dir="%TEMP%\\chrome_dev_test" --disable-web-security${urlPart}`;
    case "macos":
      return `open -n -a /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security${urlPart}`;
    case "linux":
      return `google-chrome --new-window --user-data-dir="/tmp/chrome_dev_test" --disable-web-security${urlPart}`;
    default:
      return "Vui lòng mở Chrome với flag --disable-web-security";
  }
};

/**
 * Kiểm tra xem có phải Chrome không
 * @returns {boolean}
 */
export const isChrome = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("chrome") && !userAgent.includes("edge");
};

/**
 * Thử detect Chrome Dev Mode (không chắc chắn 100%)
 * Cách này không hoàn toàn chính xác vì browser không cho phép truy cập flags
 * @returns {Promise<boolean>}
 */
export const tryDetectChromeDevMode = async () => {
  // Không có cách nào chắc chắn 100% để detect Chrome Dev Mode từ JavaScript
  // Vì browser không cho phép truy cập vào các flags
  // Cách tốt nhất là luôn cảnh báo nếu là Chrome
  
  if (!isChrome()) {
    return true; // Không phải Chrome, không cần cảnh báo
  }

  // Có thể thử một số cách gián tiếp nhưng không chắc chắn
  // Ví dụ: thử fetch cross-origin, nhưng cách này không reliable
  
  // Tạm thời return false để luôn cảnh báo (an toàn hơn)
  return false;
};

/**
 * Hiển thị cảnh báo nếu chưa chạy Chrome Dev Mode
 */
export const checkAndAlertChromeDevMode = () => {
  // Chỉ check một lần mỗi session
  const hasChecked = sessionStorage.getItem("chrome_dev_mode_checked");
  if (hasChecked) {
    return;
  }

  // Chỉ cảnh báo nếu là Chrome
  if (!isChrome()) {
    return;
  }

  const os = detectOS();
  const currentUrl = window.location.href;
  const command = getChromeDevModeCommand(os, currentUrl);

  const message = `⚠️ CẢNH BÁO: Bạn có thể chưa chạy Chrome Dev Mode!\n\n` +
    `Để sử dụng đầy đủ tính năng, vui lòng mở Chrome với flag --disable-web-security.\n\n` +
    `Chạy lệnh sau trong Terminal/Command Prompt:\n\n${command}\n\n` +
    `Sau đó mở lại website này.`;

  alert(message);
  sessionStorage.setItem("chrome_dev_mode_checked", "true");
};

