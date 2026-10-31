@echo off
chcp 65001 >nul
title Сайт-визитка — локальный просмотр
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Не найден Node.js. Установите LTS-версию: https://nodejs.org
  echo.
  pause
  exit /b 1
)

node tools\site-server.mjs
if errorlevel 1 (
  echo.
  echo   Сервер остановился с ошибкой. Текст ошибки выше.
)
pause
