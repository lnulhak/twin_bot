#!/usr/bin/env bash
# Usage: bash scripts/setup-webhook.sh https://your-ngrok-url.ngrok-free.app
set -e

if [ -z "$1" ]; then
  echo "Usage: bash scripts/setup-webhook.sh <public-url>"
  echo "Example: bash scripts/setup-webhook.sh https://abc123.ngrok-free.app"
  exit 1
fi

source .env.local

WEBHOOK_URL="$1/api/telegram/webhook"
echo "Registering webhook: $WEBHOOK_URL"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\"]}" | python3 -m json.tool

echo ""
echo "Done. Telegram will now POST to your app on every message."
