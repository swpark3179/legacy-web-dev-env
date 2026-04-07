@echo off
cd /d "%~dp0"

echo ============================================
echo   XPlatform 통합 개발팩 - Build ^& Package
echo ============================================
echo.

REM Step 1: webview-dist 정리
echo [1/4] Removing webview-dist...
if exist "webview-dist" (
    rmdir /s /q "webview-dist"
    echo       webview-dist removed.
) else (
    echo       webview-dist not found, skipping.
)
echo.

REM Step 2: TypeScript 컴파일
echo [2/4] Compiling TypeScript (npm run compile)...
call npm run compile
if errorlevel 1 (
    echo.
    echo [ERROR] TypeScript compile failed.
    pause
    exit /b 1
)
echo.

REM Step 3: Webview 빌드
echo [3/4] Building Webview (npm run compile:webview)...
call npm run compile:webview
if errorlevel 1 (
    echo.
    echo [ERROR] Webview build failed.
    pause
    exit /b 1
)
echo.

REM Step 4: VSIX 패키징
echo [4/4] Packaging VSIX (vsce package)...
call npx vsce package --allow-missing-repository
if errorlevel 1 (
    echo.
    echo [ERROR] VSIX packaging failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build ^& Package completed successfully!
echo ============================================
echo.
for %%f in (*.vsix) do echo   Output: %%f
echo.
pause
