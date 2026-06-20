@echo off
REM Zuvix Security Agent — Windows install
setlocal enabledelayedexpansion

set BIN=%ZUVIX_AGENT_BIN:zuvix-agent.exe%
if "%BIN%"=="" set BIN=zuvix-agent.exe
set SERVER=%ZUVIX_SERVER:ws://localhost:3001%
if "%SERVER%"=="" set SERVER=ws://localhost:3001
set DEVICE_ID=%ZUVIX_DEVICE_ID%
if "%DEVICE_ID%"=="" set DEVICE_ID=agent-%COMPUTERNAME%

echo ==^> Zuvix Agent Installer (Windows)
echo     Binary: %BIN%
echo     Server: %SERVER%
echo     Device: %DEVICE_ID%

REM Check if binary exists
if not exist "target\release\%BIN%" (
    where cargo >nul 2>&1
    if !errorlevel! equ 0 (
        echo ==^> Building agent from source...
        cargo build --release
    ) else (
        echo !! Rust not installed. Install from https://rustup.rs
        echo !! Then run this script again.
        exit /b 1
    )
)

REM Copy to Program Files
if not exist "%ProgramFiles%\Zuvix" mkdir "%ProgramFiles%\Zuvix"
copy /Y "target\release\%BIN%" "%ProgramFiles%\Zuvix\%BIN%"
echo ==^> Installed to %ProgramFiles%\Zuvix\%BIN%

REM Create scheduled task for auto-start
schtasks /Create /SC ONSTART /TN "ZuvixAgent" /TR "%ProgramFiles%\Zuvix\%BIN%" /F /RL HIGHEST
echo ==^> Windows scheduled task created

REM Add firewall rule
netsh advfirewall firewall add rule name="Zuvix Agent" dir=in action=allow program="%ProgramFiles%\Zuvix\%BIN%" enable=yes >nul 2>&1

echo ==^> Done. Agent will start on next login.
echo     To start now: "%ProgramFiles%\Zuvix\%BIN%"
pause
