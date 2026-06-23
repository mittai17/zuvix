#!/bin/bash
echo "Setting up Zuvix OS Personal Node for iOS (via iSH)..."
echo "Make sure you are running this inside iSH (Alpine Linux emulator)!"

apk update && apk upgrade
apk add nodejs npm git

npm install
cd server
npm install
npm run build
cd ..

npm install -g pm2
cd server
pm2 start dist/index.js --name "zuvix-node"
pm2 save

echo "iOS Node is running!"
