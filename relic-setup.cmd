@echo off
rem ============================================================
rem  relic-setup.cmd — relic 一键安装引导（Windows PowerShell）
rem ============================================================
rem  用户从 Gitee/GitHub 网页下载此文件后双击即可完成全部部署。
rem  流程：检测/安装 Node.js + Git → clone relic-source → 启动向导
rem ============================================================

setlocal enabledelayedexpansion
title relic 安装引导
color 0b
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         ◇ relic  一键安装引导                     ║
echo  ║         AI Agent 治理系统                         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

rem ── 检测 PowerShell ──
where pwsh >nul 2>&1
if %errorlevel% neq 0 (
    where powershell >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [错误] 未找到 PowerShell，无法继续。
        pause
        exit /b 1
    )
    set "PS=powershell -ExecutionPolicy Bypass -Command"
) else (
    set "PS=pwsh -ExecutionPolicy Bypass -Command"
)

%PS% ^
  "$ErrorActionPreference='Stop';" ^
  "Write-Host '  [1/4] 检测 Node.js...';" ^
  "$node = Get-Command node -ErrorAction SilentlyContinue;" ^
  "if (-not $node) {" ^
  "  Write-Host '  [1/4] Node.js 未安装，正在安装...' -ForegroundColor Yellow;" ^
  "  $wg = Get-Command winget -ErrorAction SilentlyContinue;" ^
  "  if ($wg) {" ^
  "    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent;" ^
  "  } else {" ^
  "    Write-Host '  winget 不可用。请手动安装 Node.js 后重新运行此脚本。' -ForegroundColor Red;" ^
  "    Start-Process 'https://nodejs.org/en/download';" ^
  "    Read-Host '  安装完成后按回车继续';" ^
  "  }" ^
  "  # 刷新 PATH" ^
  "  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User');" ^
  "}" ^
  "$node = Get-Command node -ErrorAction SilentlyContinue;" ^
  "if (-not $node) { Write-Host '  [错误] Node.js 仍不可用，请手动安装。' -ForegroundColor Red; exit 1 }" ^
  "Write-Host '  [1/4] Node.js OK' -ForegroundColor Green;" ^
  "" ^
  "Write-Host '  [2/4] 检测 Git...';" ^
  "$git = Get-Command git -ErrorAction SilentlyContinue;" ^
  "if (-not $git) {" ^
  "  Write-Host '  [2/4] Git 未安装，正在安装...' -ForegroundColor Yellow;" ^
  "  $wg = Get-Command winget -ErrorAction SilentlyContinue;" ^
  "  if ($wg) {" ^
  "    winget install Git.Git --accept-package-agreements --accept-source-agreements --silent;" ^
  "  } else {" ^
  "    Write-Host '  winget 不可用。请手动安装 Git 后重新运行此脚本。' -ForegroundColor Red;" ^
  "    Start-Process 'https://git-scm.com/download/win';" ^
  "    Read-Host '  安装完成后按回车继续';" ^
  "  }" ^
  "  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User');" ^
  "}" ^
  "$git = Get-Command git -ErrorAction SilentlyContinue;" ^
  "if (-not $git) { Write-Host '  [错误] Git 仍不可用。' -ForegroundColor Red; exit 1 }" ^
  "Write-Host '  [2/4] Git OK' -ForegroundColor Green;" ^
  "" ^
  "Write-Host '  [3/4] 下载 relic-source...';" ^
  "$dest = Join-Path $env:USERPROFILE 'relic-source';" ^
  "if (Test-Path (Join-Path $dest 'package.json')) {" ^
  "  Write-Host '  [3/4] 已存在，跳过下载' -ForegroundColor Green;" ^
  "} else {" ^
  "  git clone https://gitee.com/sthgs/relic-source.git $dest 2>$null;" ^
  "  if ($LASTEXITCODE -ne 0) {" ^
  "    Write-Host '  Gitee 失败，尝试 GitHub...' -ForegroundColor Yellow;" ^
  "    git clone https://github.com/STHgs/relic-source.git $dest;" ^
  "  }" ^
  "  if ($LASTEXITCODE -ne 0) { Write-Host '  [错误] 下载失败，请检查网络。' -ForegroundColor Red; exit 1 }" ^
  "}" ^
  "Write-Host '  [3/4] relic-source 就绪' -ForegroundColor Green;" ^
  "" ^
  "Write-Host '  [4/4] 启动安装向导...' -ForegroundColor Cyan;" ^
  "Set-Location $dest;" ^
  "npm install --silent 2>$null;" ^
  "node scripts/wizard.mjs;"

if %errorlevel% neq 0 (
    echo.
    echo  [错误] 安装过程中出现问题，请查看上方日志。
    pause
)

endlocal
