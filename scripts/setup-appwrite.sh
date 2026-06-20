#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Zuvix OS — Appwrite Setup Script
# Usage: ./scripts/setup-appwrite.sh
#
# Sets up an Appwrite project for Zuvix OS:
#   1. Creates or links an Appwrite project
#   2. Creates database, collections, attributes
#   3. Prints env vars to add to server/.env
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/server/.env"

echo "╔════════════════════════════════════════╗"
echo "║   Zuvix OS — Appwrite Setup           ║"
echo "╚════════════════════════════════════════╝"

# Check CLI
if ! command -v appwrite &>/dev/null; then
  echo "❌ appwrite CLI not found. Install:"
  echo "   macOS: brew install appwrite/cli/appwrite"
  echo "   Other: https://appwrite.io/docs/command-line"
  exit 1
fi

APPWRITE_CLI_VERSION=$(appwrite --version 2>/dev/null || echo "unknown")
echo "ℹ️  appwrite CLI version: $APPWRITE_CLI_VERSION"

# ── Step 1: Check login status ──
echo ""
echo "🔑 Checking Appwrite login..."
if ! appwrite client --json 2>/dev/null | grep -q "endpoint"; then
  echo "Please log in to Appwrite:"
  echo "  appwrite login"
  echo ""
  echo "Or configure your session:"
  echo "  appwrite client --endpoint https://cloud.appwrite.io/v1 --projectId <project-id> --key <api-key>"
  exit 0
fi

# ── Step 2: Create project (if needed) ──
PROJECT_ID="${1:-zuvix-os}"
echo ""
echo "📁 Using project: $PROJECT_ID"

# Try to set the project
appwrite client --projectId "$PROJECT_ID" 2>/dev/null || true

# ── Step 3: Create database ──
DATABASE_ID="zuvixdb"
echo ""
echo "🗄️  Creating database: $DATABASE_ID"

DB_EXISTS=$(appwrite databases list --json 2>/dev/null | grep -c "\"$DATABASE_ID\"" || true)
if [ "$DB_EXISTS" -eq 0 ]; then
  appwrite databases create --databaseId "$DATABASE_ID" --name "Zuvix Database" --json
  echo "✅ Database created."
else
  echo "ℹ️  Database already exists."
fi

# ── Step 4: Create collections ──
create_collection() {
  local COLLECTION_ID="$1"
  local COLLECTION_NAME="$2"
  local PERMISSION="${3:-document}"

  echo ""
  echo "📂 Creating collection: $COLLECTION_ID ($COLLECTION_NAME)"
  local EXISTS=$(appwrite databases listCollections --databaseId "$DATABASE_ID" --json 2>/dev/null | grep -c "\"$COLLECTION_ID\"" || true)
  if [ "$EXISTS" -eq 0 ]; then
    appwrite databases createCollection \
      --databaseId "$DATABASE_ID" \
      --collectionId "$COLLECTION_ID" \
      --name "$COLLECTION_NAME" \
      --permission "$PERMISSION" \
      --read '["role:all"]' \
      --write '["role:all"]' \
      --json
    echo "✅ Collection created."
  else
    echo "ℹ️  Collection already exists."
  fi
}

create_string_attribute() {
  local COLLECTION_ID="$1"
  local KEY="$2"
  local SIZE="${3:-255}"
  local REQUIRED="${4:-true}"

  echo "   Adding attribute: $KEY (string, $SIZE)"
  appwrite databases createStringAttribute \
    --databaseId "$DATABASE_ID" \
    --collectionId "$COLLECTION_ID" \
    --key "$KEY" \
    --size "$SIZE" \
    --required "$REQUIRED" \
    --json 2>/dev/null || true
}

create_enum_attribute() {
  local COLLECTION_ID="$1"
  local KEY="$2"
  local ELEMENTS="$3"

  echo "   Adding attribute: $KEY (enum)"
  appwrite databases createEnumAttribute \
    --databaseId "$DATABASE_ID" \
    --collectionId "$COLLECTION_ID" \
    --key "$KEY" \
    --elements "$ELEMENTS" \
    --required true \
    --json 2>/dev/null || true
}

create_datetime_attribute() {
  local COLLECTION_ID="$1"
  local KEY="$2"

  echo "   Adding attribute: $KEY (datetime)"
  appwrite databases createDatetimeAttribute \
    --databaseId "$DATABASE_ID" \
    --collectionId "$COLLECTION_ID" \
    --key "$KEY" \
    --required false \
    --json 2>/dev/null || true
}

# Collection: tasks
create_collection "tasks" "Scheduled Tasks"
create_string_attribute "tasks" "taskName" 255 true
create_enum_attribute "tasks" "status" '["running","stopped","error"]'
create_datetime_attribute "tasks" "createdAt"

# Collection: sessions
create_collection "sessions" "Agent Sessions"
create_string_attribute "sessions" "sessionId" 255 true
create_string_attribute "sessions" "description" 512 false
create_datetime_attribute "sessions" "createdAt"
create_datetime_attribute "sessions" "lastModified"

# Collection: logs
create_collection "logs" "Activity Logs"
create_string_attribute "logs" "agentId" 255 true
create_string_attribute "logs" "actionType" 100 true
create_string_attribute "logs" "payload" 4096 false
create_datetime_attribute "logs" "createdAt"

echo ""
echo "✅ All collections and attributes created."

# ── Step 5: Get API credentials ──
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Add these to server/.env             ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Try to get endpoint from current session
ENDPOINT=$(appwrite client --json 2>/dev/null | grep "endpoint" | cut -d'"' -f4 || echo "https://cloud.appwrite.io/v1")

echo "APPWRITE_ENDPOINT=\"$ENDPOINT\""
echo "APPWRITE_PROJECT_ID=\"$PROJECT_ID\""
echo "APPWRITE_API_KEY=\"<your-api-key>\""
echo ""

echo "🔗 Get your API key at: https://appwrite.io/console/project-$PROJECT_ID/keys"
echo ""
echo "✅ Appwrite setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Add the env vars above to server/.env"
echo "   2. Restart the Zuvix server"
echo "   3. Run: node server/dist/db/setupAppwrite.js"
