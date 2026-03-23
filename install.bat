@echo off
echo ============================================
echo  KOUPIS GROUP - P^&L Budget System
echo  Εγκατάσταση (SQLite - χωρίς SQL Server)
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js δεν βρέθηκε!
    echo Κατεβάστε από: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js: 
node --version
echo.

echo Εγκατάσταση dependencies...
call npm install
echo.

echo Δημιουργία βάσης δεδομένων...
node db/init.js
echo.

echo ============================================
echo  Εκκίνηση server...
echo  Ανοίξτε: http://localhost:3000
echo  Login: admin / admin
echo ============================================
npm start
