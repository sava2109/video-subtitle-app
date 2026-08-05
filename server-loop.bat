@echo off
rem Pokrece produkcijski server (port 3001) i automatski ga restartuje ako pukne.
cd /d "C:\Users\Dimitrijevic\video-subtitle-app"
:loop
"C:\Program Files\nodejs\node.exe" dist\app.js >> server.log 2>&1
timeout /t 5 /nobreak >nul
goto loop
