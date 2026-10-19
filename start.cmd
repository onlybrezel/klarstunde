@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 fehlt. Bitte von https://nodejs.org installieren.
  popd
  pause
  exit /b 1
)
node scripts/start.mjs %*
set "startResult=%errorlevel%"
popd
pause
exit /b %startResult%
