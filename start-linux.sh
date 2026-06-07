#!/bin/bash

# Navigate to the directory where this script is located
cd "$(dirname "$0")"

echo "Starting Portexplo Server..."

# Start the server in the background
node server.js --write --port 5050 &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting for server to initialize..."
sleep 2

# Open browser on Linux
echo "Opening browser to http://localhost:5050..."
if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:5050"
elif command -v python3 > /dev/null; then
    python3 -m webbrowser "http://localhost:5050"
else
    echo "Could not detect web browser automatically. Please open http://localhost:5050 manually."
fi

# Keep terminal open to see logs
wait $SERVER_PID
