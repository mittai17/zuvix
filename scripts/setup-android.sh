#!/bin/bash
echo "Setting up Zuvix OS Personal Node for Android (via Termux)..."
echo "Make sure you are running this inside Termux!"

pkg update && pkg upgrade -y
pkg install nodejs -y
pkg install git -y

npm install
cd server
npm install
npm run build
cd ..

npm install -g pm2
cd server
pm2 start dist/index.js --name "zuvix-node"
pm2 save

echo "Android Node is running!"
