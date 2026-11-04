@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

title 脉塔选型系统 · 自动同步（关闭此窗口即停止）

echo.
echo ════════════════════════════════════════════════════════════
echo   自动同步服务
echo ════════════════════════════════════════════════════════════
echo.
echo   工作原理：
echo     每 10 秒检查一次文件改动
echo     停止改动 30 秒后自动提交并推送
echo.
echo   ⚠ 注意：
echo     · 关闭这个窗口就停止同步
echo     · 每次保存都会产生一条提交记录
echo     · 大文件写入过程中会等待，不会推半成品
echo.
echo   日志：推送日志.txt
echo ════════════════════════════════════════════════════════════
echo.

if not exist ".git" (
  echo [错误] 当前目录还不是 git 仓库，请先运行「初始化Git.bat」
  pause
  exit /b 1
)

set IDLE_COUNT=0
set PUSH_COUNT=0

:loop
  REM 检查是否有改动（包括未跟踪文件）
  set DIRTY=0
  for /f "delims=" %%L in ('git status --porcelain 2^>nul') do set DIRTY=1

  if "!DIRTY!"=="1" (
    set /a IDLE_COUNT+=1
    if !IDLE_COUNT! GEQ 3 (
      call :do_push
      set IDLE_COUNT=0
    ) else (
      echo   检测到改动，等待稳定... [!IDLE_COUNT!/3]
    )
  ) else (
    if !IDLE_COUNT! GTR 0 set IDLE_COUNT=0
  )

  timeout /t 10 /nobreak >nul
goto loop


:do_push
  echo.
  echo ────────────────────────────────────────────
  echo   [!date! !time!] 开始同步
  echo ────────────────────────────────────────────

  git add -A

  git diff --cached --quiet
  if not errorlevel 1 (
    echo   没有实际改动，跳过
    goto :eof
  )

  for /f "tokens=2 delims==" %%d in ('wmic os get localdatetime /value ^| findstr "="') do set DT=%%d
  set MSG=自动同步 !DT:~0,4!-!DT:~4,2!-!DT:~6,2! !DT:~8,2!:!DT:~10,2!:!DT:~12,2!

  git commit -m "!MSG!" --quiet
  if errorlevel 1 (
    echo   [失败] 提交出错
    goto :eof
  )
  echo   已提交: !MSG!

  git pull --rebase origin main >nul 2>&1
  if errorlevel 1 (
    echo   [冲突] 远端与本地冲突，需手动处理
    git rebase --abort >nul 2>&1
    echo          请运行「推送.bat」查看处理办法
    goto :eof
  )

  git push origin main >nul 2>&1
  if errorlevel 1 (
    echo   [失败] 推送出错，检查网络或登录状态
    goto :eof
  )

  set /a PUSH_COUNT+=1
  echo   已推送 ✓  （本次运行累计 !PUSH_COUNT! 次）
  echo   网站约 1 分钟后更新
  echo.
goto :eof
