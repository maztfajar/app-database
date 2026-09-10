@echo off
title App Database - Fajar Wahyudi
echo ===================================================
echo             ⚡ APP DATABASE ⚡
echo      Web-based Database Client (Beekeeper)
echo         Dibuat oleh Fajar Wahyudi
echo ===================================================

start "App Database Backend" cmd /k "cd backend && npm start"
start "App Database Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Aplikasi sedang dijalankan...
echo Frontend UI : http://localhost:5173
echo Backend API : http://localhost:3001
echo.
timeout /t 3 >nul
start http://localhost:5173
