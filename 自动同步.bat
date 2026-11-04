@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

title 脉塔选型系统 · 自动同步（关闭窗口即停止）

echo.
echo ============================================================
echo   自动同步服务
echo ============================================================
echo   每 10 秒检查一次，停止改动 30 秒后自动推送
echo   关闭这个窗口即停止同步
echo ============================================================
echo.

if not exist ".git" (
  echo [错误] 不是 git 仓库，请先运行「初始化Git.bat」
  pause
  exit /b 1
)

set IDLE=0
set CNT=0

:loop
  set DIRTY=0
  for /f "delims=" %%L in ('git status --porcelain 2^>nul') do set DIRTY=1

  if "!DIRTY!"=="1" (
    set /a IDLE+=1
    if !IDLE! GEQ 3 (
      call :dopush
      set IDLE=0
    ) else (
      echo   检测到改动，等待稳定... [!IDLE!/3]
    )
  ) else (
    set IDLE=0
  )

  timeout /t 10 /nobreak >nul
goto loop

:dopush
  echo.
  echo ----------------------------------------------
  git add -A
  git diff --cached --quiet
  if not errorlevel 1 goto :eof

  for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set TS=%%i
  git commit -m "自动同步 !TS!" --quiet
  if errorlevel 1 (
    echo   [失败] 提交出错
    goto :eof
  )

  git pull --rebase origin main >nul 2>&1
  if errorlevel 1 (
    echo   [冲突] 需手动处理，请运行「推送.bat」
    git rebase --abort >nul 2>&1
    goto :eof
  )

  set PUSH_OK=0
  for /l %%n in (1,1,3) do (
    if !PUSH_OK!==0 (
      git push origin main >nul 2>&1
      if not errorlevel 1 set PUSH_OK=1
      if !PUSH_OK!==0 timeout /t 4 /nobreak >nul
    )
  )
  if !PUSH_OK!==0 (
    echo   [失败] 推送出错（已重试 3 次）
    goto :eof
  )

  set /a CNT+=1
  echo   已推送 OK - 累计 !CNT! 次
  echo   网站约 1 分钟后更新
  echo ----------------------------------------------
goto :eof
