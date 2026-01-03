@echo off
REM Script để mở Chrome với các flags dev trên Windows
REM Usage: chrome-dev.bat [URL]

set URL=%1
if "%URL%"=="" set URL=http://localhost:3000

REM Thử các đường dẫn Chrome phổ biến trên Windows
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
)

if "%CHROME_PATH%"=="" (
    echo Lỗi: Không tìm thấy Chrome. Vui lòng cài đặt Google Chrome.
    exit /b 1
)

REM Tạo thư mục user-data-dir nếu chưa tồn tại
set USER_DATA_DIR=%TEMP%\chrome_dev_test
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

REM Mở Chrome với flags
start "" "%CHROME_PATH%" --new-window --user-data-dir="%USER_DATA_DIR%" --disable-web-security "%URL%"

