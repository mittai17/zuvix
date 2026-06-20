#!/bin/sh
# Zuvix Security Agent — Linux/macOS install
set -e

BIN="${ZUVIX_AGENT_BIN:-zuvix-agent}"
SERVER="${ZUVIX_SERVER:-ws://localhost:3001}"
DEVICE_ID="${ZUVIX_DEVICE_ID:-agent-$(hostname 2>/dev/null || echo 'unknown')}"

echo "==> Zuvix Agent Installer (Linux/macOS)"
echo "    Binary: $BIN"
echo "    Server: $SERVER"
echo "    Device: $DEVICE_ID"

if [ ! -f "./target/release/zuvix-agent" ]; then
    if command -v cargo >/dev/null 2>&1; then
        echo "==> Building agent from source..."
        cargo build --release
    else
        echo "!! Rust not installed. Installing Rust toolchain..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        . "$HOME/.cargo/env"
        cargo build --release
    fi
fi

if [ "$(uname)" = "Darwin" ] || [ "$(uname)" = "Linux" ]; then
    sudo cp target/release/zuvix-agent /usr/local/bin/$BIN
    echo "==> Installed to /usr/local/bin/$BIN"
fi

# Create systemd service (Linux)
if command -v systemctl >/dev/null 2>&1; then
    sudo tee /etc/systemd/system/zuvix-agent.service > /dev/null <<EOF
[Unit]
Description=Zuvix Security Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/${BIN}
Restart=always
RestartSec=10
Environment=ZUVIX_SERVER=${SERVER}
Environment=ZUVIX_DEVICE_ID=${DEVICE_ID}

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable zuvix-agent
    sudo systemctl start zuvix-agent
    echo "==> systemd service created and started"
fi

# Create launchd plist (macOS)
if [ "$(uname)" = "Darwin" ]; then
    mkdir -p ~/Library/LaunchAgents
    cat > ~/Library/LaunchAgents/com.zuvix.agent.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zuvix.agent</string>
    <key>ProgramArguments</key>
    <array><string>/usr/local/bin/${BIN}</string></array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>ZUVIX_SERVER</key>
        <string>${SERVER}</string>
        <key>ZUVIX_DEVICE_ID</key>
        <string>${DEVICE_ID}</string>
    </dict>
    <key>KeepAlive</key><true/>
    <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
    launchctl load ~/Library/LaunchAgents/com.zuvix.agent.plist
    echo "==> macOS launchd agent loaded"
fi

echo "==> Done. Agent running as $DEVICE_ID -> $SERVER"
