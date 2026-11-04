@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   脉塔选型系统 · 重新触发 Pages 部署
echo ============================================================
echo.
echo   用途：推送成功但网站没更新时，用这个重新触发一次
echo         （通常是 GitHub Pages 服务端临时故障）
echo.

if not exist ".git" (
  echo [错误] 不是 git 仓库
  pause
  exit /b 1
)

echo   当前状态：
git log --oneline -1
echo.

echo   正在推送空提交触发部署...
git commit --allow-empty -m "重新触发 Pages 部署" --quiet
if errorlevel 1 (
  echo   [错误] 创建提交失败
  pause
  exit /b 1
)

set PUSH_OK=0
for /l %%n in (1,1,3) do (
  if !PUSH_OK!==0 (
    echo   推送尝试 %%n/3...
    git push origin main
    if not errorlevel 1 (
      set PUSH_OK=1
    ) else (
      ping -n 6 127.0.0.1 >nul
    )
  )
)

if !PUSH_OK!==0 (
  echo   [错误] 推送失败
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   已触发部署，约 1 分钟完成
echo ============================================================
echo   查看构建状态：
echo   https://github.com/SwaggyP04/MYACTUATOR--selection/actions
echo.
ping -n 6 127.0.0.1 >nul
