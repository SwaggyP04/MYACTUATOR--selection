@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ════════════════════════════════════════════════════════════
echo   脉塔电机选型系统 · 一键推送
echo ════════════════════════════════════════════════════════════

REM ── 检查仓库 ──
if not exist ".git" (
  echo.
  echo [错误] 当前目录还不是 git 仓库
  echo        请先运行「初始化Git.bat」
  pause
  exit /b 1
)

REM ── 1. 暂存所有改动 ──
git add -A

REM ── 2. 有没有改动 ──
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo   没有改动需要推送
  echo.
  timeout /t 3 /nobreak >nul
  exit /b 0
)

REM ── 3. 显示改了什么 ──
echo.
echo   本次改动：
git diff --cached --stat | findstr /v "^$"

REM ── 4. 提交 ──
for /f "tokens=2 delims==" %%d in ('wmic os get localdatetime /value ^| findstr "="') do set DT=%%d
set MSG=更新 !DT:~0,4!-!DT:~4,2!-!DT:~6,2! !DT:~8,2!:!DT:~10,2!
git commit -m "!MSG!" --quiet
if errorlevel 1 (
  echo   [错误] 提交失败
  pause
  exit /b 1
)
echo.
echo   已提交: !MSG!

REM ── 5. 先拉后推（避免和网页端编辑的 FAQ 冲突）──
echo.
echo   正在与远端同步...
git pull --rebase origin main 2>&1 | findstr /v "^$"

if errorlevel 1 (
  echo.
  echo ════════════════════════════════════════════════════════════
  echo   冲突：远端和本地都改了同一个地方
  echo ════════════════════════════════════════════════════════════
  echo.
  echo   最常见情况：你在 admin.html 网页上改过 FAQ，
  echo   本地又改了 data/faq.json。
  echo.
  echo   解决办法（二选一）：
  echo     A. 保留本地版本：
  echo          git rebase --abort
  echo          git pull --rebase -X theirs origin main
  echo          git push origin main
  echo     B. 保留远端版本：
  echo          git rebase --abort
  echo          git reset --hard origin/main
  echo.
  echo   当前状态：
  git status
  echo.
  pause
  exit /b 1
)

REM ── 6. 推送 ──
git push origin main 2>&1

if errorlevel 1 (
  echo.
  echo   [错误] 推送失败
  echo         可能原因：没登录 / 网络中断 / 权限不足
  echo         排查: git push origin main
  pause
  exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════
echo   推送成功
echo ════════════════════════════════════════════════════════════
echo.
echo   GitHub Pages 约 1 分钟后自动更新：
echo     https://swaggyp04.github.io/MYACTUATOR--selection/
echo.
timeout /t 5 /nobreak >nul
