@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   脉塔电机选型系统 · Git 首次初始化
echo ============================================================
echo.

set REPO_URL=https://github.com/SwaggyP04/MYACTUATOR--selection.git
set GIT_NAME=SwaggyP04
set GIT_EMAIL=316023590+SwaggyP04@users.noreply.github.com

where git >nul 2>nul
if errorlevel 1 (
  echo [错误] 没找到 git 命令，请先安装 Git for Windows
  pause
  exit /b 1
)
for /f "delims=" %%v in ('git --version') do echo [1/7] %%v

git config --global user.name "%GIT_NAME%" 2>nul
git config --global user.email "%GIT_EMAIL%" 2>nul
git config --global credential.helper manager 2>nul
echo [2/7] 提交身份: %GIT_NAME%

if exist ".git" (
  echo [3/7] 已经是 git 仓库，跳过初始化
) else (
  git init -b main >nul 2>&1
  if errorlevel 1 git init >nul 2>&1
  echo [3/7] 已创建 git 仓库
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
  echo [4/7] 已绑定远端
) else (
  git remote set-url origin "%REPO_URL%"
  echo [4/7] 远端已存在，已更新地址
)

echo [5/7] 正在读取远端历史...
git fetch origin main
if errorlevel 1 (
  echo [错误] 无法访问远端仓库，请检查网络
  pause
  exit /b 1
)

git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
  echo [6/7] 首次初始化：对齐远端历史，保留本地文件
  git reset --mixed origin/main >nul 2>&1
  git checkout origin/main -- README.md 2>nul
) else (
  echo [6/7] 已有本地提交，执行 pull --rebase
  git pull --rebase origin main
)

echo [7/7] 检查改动...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set TS=%%i
  git commit -m "本地同步 !TS!" --quiet
  echo       已提交: 本地同步 !TS!
) else (
  echo       没有新改动需要提交
)

echo.
echo       正在推送到 GitHub...
git push -u origin main

if errorlevel 1 (
  echo ============================================================
  echo   推送失败：检查浏览器授权 / 网络 / 远端冲突
  echo ============================================================
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   初始化完成
echo ============================================================
echo   以后双击「推送.bat」即可同步
echo.
pause
