@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ════════════════════════════════════════════════════════════
echo   脉塔电机选型系统 · Git 首次初始化
echo ════════════════════════════════════════════════════════════
echo.

set REPO_URL=https://github.com/SwaggyP04/MYACTUATOR--selection.git
set GIT_NAME=SwaggyP04
set GIT_EMAIL=316023590+SwaggyP04@users.noreply.github.com

REM ── 1. 检查 Git ──
where git >nul 2>nul
if errorlevel 1 (
  echo [错误] 没找到 git 命令
  echo        请先安装 Git for Windows: https://git-scm.com/download/win
  pause
  exit /b 1
)
for /f "delims=" %%v in ('git --version') do echo [1/7] %%v

REM ── 2. 设置提交身份 ──
git config --global user.name "%GIT_NAME%" 2>nul
git config --global user.email "%GIT_EMAIL%" 2>nul
echo [2/7] 提交身份: %GIT_NAME% ^<%GIT_EMAIL%^>

REM ── 3. 初始化仓库 ──
if exist ".git" (
  echo [3/7] 已经是 git 仓库，跳过初始化
) else (
  git init -b main >nul 2>&1
  if errorlevel 1 git init >nul 2>&1
  echo [3/7] 已创建 git 仓库
)

REM ── 4. 绑定远端 ──
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
  echo [4/7] 已绑定远端: %REPO_URL%
) else (
  git remote set-url origin "%REPO_URL%"
  echo [4/7] 远端已存在，已更新地址
)

REM ── 5. 拉取远端历史 ──
echo [5/7] 正在读取远端历史...
git fetch origin main 2>&1 | findstr /v "^$"
if errorlevel 1 (
  echo.
  echo [错误] 无法访问远端仓库
  echo        检查网络，或先手动执行: git fetch origin main
  pause
  exit /b 1
)

REM ── 6. 对齐远端历史（保留本地文件）──
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
  echo [6/7] 首次初始化：对齐远端历史，保留本地文件
  git reset --mixed origin/main >nul 2>&1
  REM 远端有但本地没有的文件（README.md），从远端取回，避免被误删
  git checkout origin/main -- README.md 2>nul
  if errorlevel 1 echo        注意: README.md 不存在于远端，跳过
) else (
  echo [6/7] 已有本地提交，执行 pull --rebase
  git pull --rebase origin main 2>&1 | findstr /v "^$"
)

REM ── 7. 提交并推送 ──
echo [7/7] 检查改动...
git add -A

git diff --cached --quiet
if errorlevel 1 (
  for /f "tokens=2 delims==" %%d in ('wmic os get localdatetime /value ^| findstr "="') do set DT=%%d
  set MSG=本地项目首次同步 !DT:~0,4!-!DT:~4,2!-!DT:~6,2!
  git commit -m "!MSG!" --quiet
  echo       已提交: !MSG!
) else (
  echo       没有新改动需要提交
)

echo.
echo       正在推送到 GitHub（首次会弹出浏览器登录）...
git push -u origin main 2>&1

if errorlevel 1 (
  echo.
  echo ════════════════════════════════════════════════════════════
  echo   推送失败
  echo ════════════════════════════════════════════════════════════
  echo   常见原因：
  echo   1. 浏览器登录窗口没完成授权  → 重新运行本脚本
  echo   2. 网络问题                   → 检查能否访问 github.com
  echo   3. 远端有新提交               → 脚本已自动 pull，若冲突需手动处理
  echo.
  echo   排查命令：
  echo     git status
  echo     git log --oneline -5
  echo     git push -u origin main
  echo.
  pause
  exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════
echo   初始化完成
echo ════════════════════════════════════════════════════════════
echo.
echo   以后每次改完文件，双击「推送.bat」即可
echo   想全自动，双击「自动同步.bat」
echo.
echo   网站地址：
echo     https://swaggyp04.github.io/MYACTUATOR--selection/
echo.
pause
