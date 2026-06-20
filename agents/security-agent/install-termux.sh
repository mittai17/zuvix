#!/data/data/com.termux/files/usr/bin/sh
# Zuvix Security Agent — Android (Termux) install
set -e

BIN="${ZUVIX_AGENT_BIN:-zuvix-agent}"
SERVER="${ZUVIX_SERVER:-ws://YOUR_SERVER_IP:3001}"
DEVICE_ID="${ZUVIX_DEVICE_ID:-android-$(getprop ro.serialno 2>/dev/null || echo 'termux')}"

echo "==> Zuvix Agent Installer (Android/Termux)"
echo "    Server: $SERVER"
echo "    Device: $DEVICE_ID"

# Install dependencies
pkg update -y
pkg install -y rust cmake binutils

# Build agent
echo "==> Building agent..."
cargo build --release

# Copy to bin
cp target/release/zuvix-agent $PREFIX/bin/$BIN
echo "==> Installed to $PREFIX/bin/$BIN"

# Create Termux:Boot script for auto-start
BOOT_DIR="$HOME/.termux/boot"
mkdir -p "$BOOT_DIR"
cat > "$BOOT_DIR/zuvix-agent.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
export ZUVIX_SERVER="$SERVER"
export ZUVIX_DEVICE_ID="$DEVICE_ID"
exec $BIN
EOF
chmod +x "$BOOT_DIR/zuvix-agent.sh"

# Request storage permissions (for file access)
termux-setup-storage 2>/dev/null || true

echo "==> Done. Agent configured as $DEVICE_ID"
echo "    Start now: $BIN"
echo "    Auto-starts on Termux boot (if Termux:Boot is installed)"
