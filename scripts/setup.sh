#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━ Echo Twin Setup ━━━${NC}"
echo ""

# ── 1. Platform check ────────────────────────────────────────────────────────
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}✗ Echo Twin requires macOS.${NC}"
  echo "  The polling daemon uses launchd (macOS-only)."
  echo "  On Linux/Windows, run the poller manually:"
  echo "    watch -n 10 curl -s -X POST http://localhost:3000/api/telegram/poll"
  echo ""
  echo "  Continuing setup (skip daemon install)..."
  SKIP_DAEMON=true
fi

# ── 2. Node version ───────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install Node 22+ from https://nodejs.org${NC}"
  exit 1
fi
NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo -e "${RED}✗ Node $NODE_MAJOR found — need Node 22+.${NC}"
  echo "  Run: nvm install 22 && nvm use 22"
  exit 1
fi
echo -e "${GREEN}✓ Node $(node -v)${NC}"

# ── 3. Install dependencies ───────────────────────────────────────────────────
echo -e "${BLUE}→ Installing dependencies...${NC}"
npm install --silent

# ── 4. Environment file ───────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo -e "${YELLOW}→ Created .env.local — fill in your credentials before continuing.${NC}"
  echo ""
  echo "  Required:"
  echo "    OPENAI_API_KEY   — https://platform.openai.com/api-keys"
  echo "    TELEGRAM_BOT_TOKEN — from @BotFather on Telegram"
  echo "    TELEGRAM_CHAT_ID   — your Telegram user ID (see README)"
  echo ""
  echo "  Edit .env.local now, then re-run this script."
  exit 0
fi
echo -e "${GREEN}✓ .env.local found${NC}"

# ── 5. Check required env vars ────────────────────────────────────────────────
source .env.local 2>/dev/null || true
MISSING=()
[ -z "$OPENAI_API_KEY" ] && MISSING+=("OPENAI_API_KEY")
[ -z "$TELEGRAM_BOT_TOKEN" ] && MISSING+=("TELEGRAM_BOT_TOKEN")
[ -z "$TELEGRAM_CHAT_ID" ] && MISSING+=("TELEGRAM_CHAT_ID")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}✗ Missing required values in .env.local: ${MISSING[*]}${NC}"
  echo "  Fill them in and re-run."
  exit 1
fi
echo -e "${GREEN}✓ Environment variables set${NC}"

# ── 6. Database ───────────────────────────────────────────────────────────────
echo -e "${BLUE}→ Setting up database...${NC}"
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init 2>/dev/null
echo -e "${GREEN}✓ Database ready${NC}"

# ── 7. Register Telegram bot commands ────────────────────────────────────────
echo -e "${BLUE}→ Registering Telegram bot commands...${NC}"
bash scripts/set-bot-commands.sh > /dev/null 2>&1 && echo -e "${GREEN}✓ Bot commands registered${NC}" || echo -e "${YELLOW}⚠ Could not register commands (check bot token)${NC}"

# ── 8. Install polling LaunchAgent (macOS only) ───────────────────────────────
if [ "$SKIP_DAEMON" != "true" ]; then
  PLIST="$HOME/Library/LaunchAgents/ai.echotwin.telegram-poll.plist"
  SCRIPT_PATH="$(pwd)/scripts/telegram-poll.sh"

  # Unload existing if present
  launchctl unload "$PLIST" 2>/dev/null || true

  cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.echotwin.telegram-poll</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>${SCRIPT_PATH}</string>
  </array>
  <key>StartInterval</key>
  <integer>10</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/echo-twin-poll.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/echo-twin-poll.log</string>
</dict>
</plist>
EOF

  launchctl load "$PLIST"
  echo -e "${GREEN}✓ Polling daemon installed (runs every 10s, survives reboots)${NC}"
fi

# ── 9. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━ Setup complete ━━━${NC}"
echo ""
echo "  Start the app:"
echo "    npm run dev"
echo ""
echo "  Then send /start to your Telegram bot to begin onboarding."
echo ""
echo "  To stop the polling daemon:"
echo "    launchctl unload ~/Library/LaunchAgents/ai.echotwin.telegram-poll.plist"
echo ""
echo "  To reset everything:"
echo "    bash scripts/dev-reset.sh"
