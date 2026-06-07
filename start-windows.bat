@echo off
TITLE Portexplo Server

echo Starting Portexplo Server...
cd /d "%~dp0"

:: Start the server in the background and open the browser
start "" http://localhost:5050
node server.js --write --port 5050

pause
