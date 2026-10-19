@echo off
title DIP Platform Server
echo.
echo  ============================================
echo    DIP Platform - Starting...
echo  ============================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% equ 0 (
    node server.js
    goto :done
)

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" server.js
    goto :done
)

echo.
echo  [ERROR] Node.js not found!
echo  Please install Node.js from https://nodejs.org/
echo.

:done
echo.
echo  Server has stopped.
pause
