@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   脉塔电机选型系统 · 一键推送
echo ============================================================
echo.

if not exist ".git" (
  echo [错误] 当前目录不是 git 仓库，请先运行「初始化Git.bat」
  pause
  exit /b 1
)

git add -A

git diff --cached --quiet
if not errorlevel 1 (
  echo   没有改动需要推送
  timeout /t 3 /nobreak >nul
  exit /b 0
)

echo   本次改动：
git diff --cached --stat

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set TS=%%i
git commit -m "更新 !TS!" --quiet
if errorlevel 1 (
  echo   [错误] 提交失败
  pause
  exit /b 1
)
echo.
echo   已提交: 更新 !TS!

echo   正在与远端同步...
git pull --rebase origin main

if errorlevel 1 (
  echo.
  echo ============================================================
  echo   冲突：远端和本地都改了同一处
  echo ============================================================
  echo   常见情况：你在 admin.html 网页改过 FAQ，本地又改了 data/faq.json
  echo.
  echo   保留本地版本：
  echo     git rebase --abort
  echo     git pull --rebase -X theirs origin main
  echo     git push origin main
  echo.
  echo   保留远端版本：
  echo     git rebase --abort
  echo     git reset --hard origin/main
  echo.
  git status
  pause
  exit /b 1
)

git push origin main

if errorlevel 1 (
  echo   [错误] 推送失败，检查网络或登录状态
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   推送成功
echo ============================================================
echo   约 1 分钟后生效：
echo   https://swaggyp04.github.io/MYACTUATOR--selection/
echo.
timeout /t 5 /nobreak >nul
