@echo off
echo Packaging TW Controller for Linode deployment...
echo.

cd /d d:\TW\Multy

REM Create deployment directory
if exist deployment rmdir /s /q deployment
mkdir deployment

REM Copy server files
echo Copying server files...
xcopy /E /I /Y server deployment\server

REM Remove node_modules (will reinstall on server)
if exist deployment\server\node_modules rmdir /s /q deployment\server\node_modules

REM Create zip file (requires PowerShell)
echo Creating deployment.zip...
powershell -command "Compress-Archive -Path deployment\server\* -DestinationPath deployment.zip -Force"

REM Cleanup
rmdir /s /q deployment

echo.
echo ========================================
echo Deployment package created: deployment.zip
echo ========================================
echo.
echo Next steps:
echo 1. Upload deployment.zip to your Linode server
echo 2. Extract: unzip deployment.zip
echo 3. Install dependencies: npm install
echo 4. Start server: npm start
echo.
echo See deploy-to-linode.md for detailed instructions
echo.
pause
