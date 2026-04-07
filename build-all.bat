@echo off
cd /d "%~dp0"

echo Removing webview-dist...
if exist "webview-dist" (
    rmdir /s /q "webview-dist"
    echo webview-dist removed.
) else (
    echo webview-dist not found, skipping.
)

echo.
echo Running compile...
call npm run compile
if errorlevel 1 exit /b 1

echo.
echo Running compile:webview...
call npm run compile:webview
if errorlevel 1 exit /b 1

echo.
echo build:all done.