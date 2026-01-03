#!/usr/bin/env node

const { spawn } = require('child_process');
const { exec } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

// Hàm tìm đường dẫn Chrome
function findChromePath() {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    // macOS
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (platform === 'win32') {
    // Windows - thử các đường dẫn phổ biến
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    ];
    
    for (const chromePath of possiblePaths) {
      const fs = require('fs');
      try {
        if (fs.existsSync(chromePath)) {
          return chromePath;
        }
      } catch (e) {
        // Continue searching
      }
    }
    
    // Nếu không tìm thấy, trả về đường dẫn mặc định
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else {
    // Linux
    return 'google-chrome';
  }
}

// Hàm mở Chrome với flags
function openChromeWithFlags(url) {
  const platform = os.platform();
  const chromePath = findChromePath();
  const fs = require('fs');
  
  // Kiểm tra Chrome có tồn tại không
  if (platform !== 'linux' && !fs.existsSync(chromePath)) {
    console.error(`❌ Không tìm thấy Chrome tại: ${chromePath}`);
    console.log('💡 Vui lòng cài đặt Google Chrome hoặc kiểm tra đường dẫn.');
    return;
  }
  
  if (platform === 'darwin') {
    // macOS - dùng lệnh open
    const command = `open -n -a "${chromePath}" --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security "${url}"`;
    exec(command, (error) => {
      if (error) {
        console.error('Lỗi khi mở Chrome:', error);
      } else {
        console.log('✅ Đã mở Chrome với flags dev (--disable-web-security)');
      }
    });
  } else if (platform === 'win32') {
    // Windows - dùng spawn để tránh vấn đề với đường dẫn có khoảng trắng
    const userDataDir = path.join(os.tmpdir(), 'chrome_dev_test');
    
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    const args = [
      '--new-window',
      `--user-data-dir=${userDataDir}`,
      '--disable-web-security',
      url
    ];
    
    const chromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    chromeProcess.unref(); // Cho phép process cha tiếp tục chạy
    
    // Đợi một chút để kiểm tra xem Chrome có mở được không
    setTimeout(() => {
      try {
        chromeProcess.kill(0); // Kiểm tra xem process còn sống không
      } catch (e) {
        // Process đã chết hoặc không thể kiểm tra, nhưng không sao
      }
    }, 1000);
    
    console.log('✅ Đã mở Chrome với flags dev (--disable-web-security)');
  } else {
    // Linux
    const command = `${chromePath} --new-window --user-data-dir="/tmp/chrome_dev_test" --disable-web-security "${url}"`;
    exec(command, (error) => {
      if (error) {
        console.error('Lỗi khi mở Chrome:', error);
      } else {
        console.log('✅ Đã mở Chrome với flags dev (--disable-web-security)');
      }
    });
  }
}

// Hàm kiểm tra xem server đã sẵn sàng chưa
function waitForServer(url, maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkServer = () => {
      attempts++;
      const req = http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          resolve();
        } else {
          if (attempts < maxAttempts) {
            setTimeout(checkServer, interval);
          } else {
            reject(new Error('Server không phản hồi sau nhiều lần thử'));
          }
        }
      });
      
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(checkServer, interval);
        } else {
          reject(new Error('Không thể kết nối đến server'));
        }
      });
      
      req.setTimeout(500, () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(checkServer, interval);
        } else {
          reject(new Error('Timeout khi kiểm tra server'));
        }
      });
    };
    
    checkServer();
  });
}

// Chạy react-scripts start
console.log('🚀 Đang khởi động React development server...');
const reactScripts = spawn('react-scripts', ['start'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    BROWSER: 'none' // Tắt auto-open mặc định của react-scripts
  }
});

// Đợi server start và mở Chrome
waitForServer('http://localhost:3000')
  .then(() => {
    console.log('✅ Server đã sẵn sàng, đang mở Chrome...');
    openChromeWithFlags('http://localhost:3000');
  })
  .catch((error) => {
    console.warn('⚠️  Không thể tự động mở Chrome:', error.message);
    console.log('💡 Bạn có thể tự mở Chrome với lệnh:');
    const platform = os.platform();
    if (platform === 'win32') {
      const userDataDir = path.join(os.tmpdir(), 'chrome_dev_test');
      const chromePath = findChromePath();
      console.log(`   "${chromePath}" --new-window --user-data-dir="${userDataDir}" --disable-web-security http://localhost:3000`);
    } else if (platform === 'darwin') {
      console.log('   open -n -a "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security http://localhost:3000');
    } else {
      console.log('   google-chrome --new-window --user-data-dir="/tmp/chrome_dev_test" --disable-web-security http://localhost:3000');
    }
  });

reactScripts.on('close', (code) => {
  console.log(`\nReact scripts đã dừng với code ${code}`);
});

