@echo off
setlocal
title StatSkill AI

echo ========================================================
echo   Starting StatSkill AI (Frontend + Backend)
echo ========================================================
echo.

:: Free port 4000 if occupied by a previous run
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000 "') do (
    echo Freeing port 4000 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: Free port 5173 if occupied by a previous run
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do (
    echo Freeing port 5173 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting servers...
echo Frontend will open at: http://localhost:5173
echo Backend will open at:  http://127.0.0.1:4000
echo.
npm run dev
pause
