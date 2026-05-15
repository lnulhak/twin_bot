#!/usr/bin/env bash
# Polls Telegram for new messages and processes replies via the Next.js app
curl -s -X POST http://localhost:3000/api/telegram/poll >> /tmp/echo-twin-poll.log 2>&1
