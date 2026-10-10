@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 没找到 node，请先安装 Node.js（FD 需要本地服务器才能授权数据目录）
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8791/"
node fd-serve.mjs
