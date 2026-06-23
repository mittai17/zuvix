#!/bin/bash
echo "Setting up Zuvix OS Personal Node for macOS/Linux..."
echo "This script configures your machine to run the Zuvix backend silently on startup."

# 1. Install Node Dependencies
echo "Installing dependencies..."
npm install

# 2. Build the Backend
echo "Building Zuvix Server..."
cd server
npm install
npm run build
cd ..

# 3. Setup PM2 for Background Execution
echo "Installing PM2 globally..."
sudo npm install -g pm2

# 4. Start Zuvix Server in Background
echo "Starting Zuvix Server..."
cd server
pm2 start dist/index.js --name "zuvix-node"

# 5. Save to Startup
echo "Configuring auto-start on boot..."
pm2 save
pm2 startup

echo "================================================"
echo "Zuvix OS Node is now running in the background!"
echo "You can now access your agent from the Web UI."
echo "To monitor logs: pm2 logs zuvix-node"
echo "================================================"
