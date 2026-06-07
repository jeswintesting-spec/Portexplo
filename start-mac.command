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

# Open browser on macOS
echo "Opening browser to http://localhost:5050..."
open "http://localhost:5050"

# Keep terminal open to see logs
wait $SERVER_PID
