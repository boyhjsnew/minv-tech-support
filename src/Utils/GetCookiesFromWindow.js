/**
 * Tạo script để tự động lưu cookies vào localStorage (chạy trên trang 2.0)
 * @param {string} taxCode - Mã số thuế
 * @returns {string} - Script JavaScript để inject vào trang 2.0
 */
export function generateAutoSaveCookiesScript(taxCode) {
  const script = `
(function() {
  // Lưu cookies vào localStorage với key đặc biệt
  const cookies = document.cookie;
  const storageKey = 'minv_tool_cookies_${taxCode}';
  
  if (cookies && cookies.length > 0) {
    localStorage.setItem(storageKey, cookies);
    console.log('✅ Đã tự động lưu cookies vào localStorage');
    
    // Gửi message về parent window (nếu có)
    if (window.opener) {
      window.opener.postMessage({
        type: 'COOKIES_SAVED',
        taxCode: '${taxCode}',
        cookies: cookies
      }, '*');
    }
  }
})();
  `.trim();
  
  return script;
}

/**
 * Tạo script để lấy cookies từ trang 2.0 và copy vào clipboard
 * @param {string} taxCode - Mã số thuế
 * @returns {string} - Script JavaScript để chạy trên trang 2.0
 */
export function generateGetCookiesScript(taxCode) {
  return generateAutoSaveCookiesScript(taxCode);
}

/**
 * Mở trang 2.0 và inject script để lấy cookies
 * @param {string} taxCode - Mã số thuế
 * @param {Function} onCookiesReceived - Callback khi nhận được cookies
 */
export function openPageAndGetCookies(taxCode, onCookiesReceived) {
  const url = `https://${taxCode}.minvoice.net/#/`;
  const script = generateGetCookiesScript(taxCode);
  
  // Mở trang 2.0
  const newWindow = window.open(url, '_blank');
  
  if (newWindow) {
    // Đợi window load xong
    setTimeout(() => {
      try {
        // Inject script vào trang 2.0
        newWindow.eval(script);
      } catch (error) {
        console.error('Không thể inject script do cross-origin:', error);
        // Nếu không thể inject, hiển thị script cho user copy
        const scriptText = `// Mở Console (F12) trên trang 2.0 và chạy script này:\n${script}`;
        console.log(scriptText);
        alert('Vui lòng mở Console (F12) trên trang 2.0 và chạy script đã hiển thị trong console của trang này.');
      }
    }, 2000);
  }
}

/**
 * Lấy cookies từ localStorage (nếu đã lưu trước đó)
 * Script trên trang 2.0 sẽ lưu với key 'minv_tool_cookies_{taxCode}'
 * @param {string} taxCode - Mã số thuế
 * @returns {string|null} - Cookies hoặc null
 */
export function getCookiesFromStorage(taxCode) {
  const key = `minv_tool_cookies_${taxCode}`;
  return localStorage.getItem(key);
}

/**
 * Lưu cookies vào localStorage
 * @param {string} taxCode - Mã số thuế
 * @param {string} cookies - Cookie string
 */
export function saveCookiesToStorage(taxCode, cookies) {
  const key = `minv_tool_cookies_${taxCode}`;
  localStorage.setItem(key, cookies);
}

/**
 * Mở trang 2.0 và tự động inject script để lưu cookies
 * @param {string} taxCode - Mã số thuế
 * @param {Function} onCookiesReceived - Callback khi nhận được cookies
 */
export function openPageAndAutoGetCookies(taxCode, onCookiesReceived) {
  const url = `https://${taxCode}.minvoice.net/#/`;
  const script = generateAutoSaveCookiesScript(taxCode);
  
  // Mở trang 2.0
  const newWindow = window.open(url, '_blank');
  
  // Lắng nghe message từ window con
  const messageHandler = (event) => {
    if (event.data && event.data.type === 'COOKIES_SAVED' && event.data.taxCode === taxCode) {
      const cookies = event.data.cookies;
      saveCookiesToStorage(taxCode, cookies);
      if (onCookiesReceived) {
        onCookiesReceived(cookies);
      }
      window.removeEventListener('message', messageHandler);
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  if (newWindow) {
    // Đợi window load xong rồi inject script
    const checkWindow = setInterval(() => {
      try {
        if (newWindow.closed) {
          clearInterval(checkWindow);
          window.removeEventListener('message', messageHandler);
          return;
        }
        
        // Thử inject script (có thể fail do cross-origin)
        try {
          newWindow.eval(script);
          clearInterval(checkWindow);
        } catch (e) {
          // Cross-origin, không thể inject trực tiếp
          // Script sẽ được inject thông qua bookmarklet hoặc user chạy thủ công
        }
      } catch (e) {
        // Window đã đóng hoặc không thể truy cập
        clearInterval(checkWindow);
        window.removeEventListener('message', messageHandler);
      }
    }, 1000);
    
    // Timeout sau 30 giây
    setTimeout(() => {
      clearInterval(checkWindow);
      window.removeEventListener('message', messageHandler);
    }, 30000);
    
    // Kiểm tra localStorage định kỳ (fallback)
    const checkStorage = setInterval(() => {
      const cookies = getCookiesFromStorage(taxCode);
      if (cookies) {
        clearInterval(checkStorage);
        if (onCookiesReceived) {
          onCookiesReceived(cookies);
        }
      }
    }, 2000);
    
    // Timeout sau 60 giây
    setTimeout(() => {
      clearInterval(checkStorage);
    }, 60000);
  }
}

