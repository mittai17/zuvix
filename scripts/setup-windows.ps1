# Zuvix OS Background Node Setup (Windows)

Write-Host "Setting up Zuvix OS Personal Node for Windows..."
Write-Host "This script configures your PC to run the Zuvix backend silently on startup."

# 1. Install Node Dependencies
Write-Host "Installing dependencies..."
npm install

# 2. Build the Backend
Write-Host "Building Zuvix Server..."
cd server
npm install
npm run build
cd ..

# 3. Setup PM2 for Background Execution
Write-Host "Installing PM2 globally to manage background process..."
npm install -g pm2

# 4. Start Zuvix Server in Background
Write-Host "Starting Zuvix Server..."
cd server
pm2 start dist/index.js --name "zuvix-node"

# 5. Save to Windows Startup
Write-Host "Configuring auto-start on boot..."
pm2 save
npm install -g pm2-windows-startup
pm2-startup install

Write-Host "================================================"
Write-Host "Zuvix OS Node is now running in the background!"
Write-Host "You can now access your agent from the Web UI."
Write-Host "To monitor logs: pm2 logs zuvix-node"
Write-Host "================================================"
