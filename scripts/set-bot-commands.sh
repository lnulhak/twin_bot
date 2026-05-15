#!/usr/bin/env bash
source .env.local

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMyCommands"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Set up your twin"},
      {"command": "today", "description": "Today'\''s blocks"},
      {"command": "done", "description": "Mark a block complete — /done 2"},
      {"command": "streak", "description": "Your current streak"},
      {"command": "twin", "description": "What your twin is doing now"},
      {"command": "plan", "description": "This week overview"},
      {"command": "reset", "description": "Start over"},
      {"command": "help", "description": "All commands"}
    ]
  }' | python3 -m json.tool
