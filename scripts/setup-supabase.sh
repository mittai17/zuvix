#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Zuvix OS — Supabase Setup Script
# Usage: ./scripts/setup-supabase.sh [project-ref]
#
# Sets up a Supabase project for Zuvix OS:
#   1. Links (or creates) a Supabase project
#   2. Pushes migrations (creates all tables)
#   3. Generates TypeScript types
#   4. Prints env vars to add to server/.env
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SUPABASE_DIR="$PROJECT_ROOT/supabase"
ENV_FILE="$PROJECT_ROOT/server/.env"

echo "╔════════════════════════════════════════╗"
echo "║   Zuvix OS — Supabase Setup           ║"
echo "╚════════════════════════════════════════╝"

# Check CLI
if ! command -v supabase &>/dev/null; then
  echo "❌ supabase CLI not found. Install: npm install -g supabase"
  exit 1
fi

SUPABASE_CLI_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
echo "ℹ️  supabase CLI version: $SUPABASE_CLI_VERSION"

# ── Step 1: Link or create project ──
PROJECT_REF="${1:-}"
if [ -z "$PROJECT_REF" ]; then
  echo ""
  echo "No project ref provided."
  echo "  • To link an existing project, run:"
  echo "      supabase link --project-ref <ref>"
  echo "  • To create a new project, run:"
  echo "      supabase projects create ZuvixOS --org-id <org-id>"
  echo ""
  echo "Then re-run this script with the project ref."
  echo "  $0 <project-ref>"
  exit 0
fi

echo ""
echo "🔗 Linking project: $PROJECT_REF"
cd "$SUPABASE_DIR"

if [ -f ".temp/linked-project.json" ]; then
  EXISTING_REF=$(grep -o '"ref":"[^"]*"' .temp/linked-project.json | cut -d'"' -f4)
  if [ "$EXISTING_REF" != "$PROJECT_REF" ]; then
    echo "⚠️  Already linked to $EXISTING_REF. Re-linking..."
    rm -f .temp/linked-project.json
  fi
fi

supabase link --project-ref "$PROJECT_REF"

# ── Step 2: Get connection info ──
echo ""
echo "🔍 Retrieving connection info..."
POOLER_URL=$(supabase projects list --json 2>/dev/null | grep -A5 "\"$PROJECT_REF\"" | grep "pooler_url" | cut -d'"' -f4 || echo "")
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo ""
echo "  Project URL:  $SUPABASE_URL"
echo "  Pooler URL:   ${POOLER_URL:-"(not available)"}"
echo ""

# ── Step 3: Push migrations ──
echo "📦 Pushing database migrations..."
supabase db push

echo ""
echo "✅ Migrations applied."

# ── Step 4: Generate TypeScript types ──
echo ""
echo "📝 Generating TypeScript types..."
mkdir -p "$PROJECT_ROOT/server/src/db/types"
supabase gen types typescript --local > "$PROJECT_ROOT/server/src/db/types/supabase.ts" 2>/dev/null || \
  supabase gen types typescript --linked > "$PROJECT_ROOT/server/src/db/types/supabase.ts" 2>/dev/null || \
  echo "⚠️  Could not generate types (OK — db will still work)"

if [ -f "$PROJECT_ROOT/server/src/db/types/supabase.ts" ]; then
  echo "✅ Generated types at server/src/db/types/supabase.ts"
fi

# ── Step 5: Print env vars ──
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Add these to server/.env             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "SUPABASE_URL=\"$SUPABASE_URL\""
echo "SUPABASE_ANON_KEY=\"<your-anon-key>\""
echo "SUPABASE_SERVICE_ROLE_KEY=\"<your-service-role-key>\""
echo ""

# Check existing .env
if [ -f "$ENV_FILE" ]; then
  if grep -q "SUPABASE_URL" "$ENV_FILE"; then
    sed -i "s|^SUPABASE_URL=.*|SUPABASE_URL=\"$SUPABASE_URL\"|" "$ENV_FILE"
    echo "ℹ️  Updated SUPABASE_URL in server/.env"
  fi
fi

echo ""
echo "🔗 Go to https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
echo "   to get your anon key and service_role key."
echo ""
echo "✅ Supabase setup complete!"
