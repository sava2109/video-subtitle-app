@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo Oslobadjam portove 3000 i 3001 (ako su zauzeti)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul

echo Pokrecem backend (port 3001)...
start "SubtitleApp-Backend" /min cmd /c "npm run dev"

echo Pokrecem frontend (port 3000)...
start "SubtitleApp-Frontend" /min cmd /c "cd client && npm start"

echo Cekam da serveri postanu dostupni...
set /a tries=0
:waitloop
set /a tries+=1
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('localhost',3000)).Close(); (New-Object Net.Sockets.TcpClient('localhost',3001)).Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
    if !tries! GEQ 60 (
        echo Serveri se ne odazivaju posle 60s, otvaram browser svejedno...
        goto openbrowser
    )
    timeout /t 1 /nobreak >nul
    goto waitloop
)

:openbrowser
set "PROFILE_DIR=%TEMP%\subtitle-app-browser-profile"
set "BROWSER_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXE (
    echo Nije pronadjen Chrome ni Edge - otvaram u podrazumevanom browseru.
    echo Zatvori ovaj prozor rucno kada zavrsis, da bi se serveri ugasili.
    start http://localhost:3000
    pause >nul
) else (
    echo Otvaram aplikaciju u posebnom prozoru...
    start "" /wait "%BROWSER_EXE%" --user-data-dir="%PROFILE_DIR%" --app=http://localhost:3000
)

echo.
echo Prozor je zatvoren - gasim servere...
taskkill /FI "WINDOWTITLE eq SubtitleApp-Backend*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq SubtitleApp-Frontend*" /T /F >nul 2>nul
echo Gotovo.
timeout /t 2 /nobreak >nul
endlocal
