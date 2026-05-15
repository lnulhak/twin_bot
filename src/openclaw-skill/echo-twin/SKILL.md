---
name: echo-twin
description: Handles Echo Twin twin-persona nudges and replies via Telegram. Triggered by cron jobs for outbound nudges, and by incoming Telegram messages for replies.
metadata:
  openclaw:
    requires:
      env:
        - ECHO_TWIN_API_URL
      bins:
        - curl
      primaryEnv: ECHO_TWIN_API_URL
---

# Echo Twin Skill

You handle two types of interactions:

## 1. Outbound nudge (cron-triggered)

When triggered by a cron job, the message contains a block id in the format `nudge blockId=<N>`.

Steps:
1. Parse the block id from the message.
2. Call the Echo Twin API:
   ```
   curl -s -X POST "$ECHO_TWIN_API_URL/api/twin/nudge" \
     -H "Content-Type: application/json" \
     -d "{\"blockId\": <N>}"
   ```
3. The API returns `{ "message": "..." }`. Extract the message field.
4. Send that message to the user via Telegram using the message send tool with target `805422072`.

## 2. Inbound reply (user messages on Telegram)

When the user sends a message to the Telegram bot that does NOT contain `nudge blockId=`:

1. Take the user's message text.
2. Call the Echo Twin reply API:
   ```
   curl -s -X POST "$ECHO_TWIN_API_URL/api/twin/reply" \
     -H "Content-Type: application/json" \
     -d "{\"body\": \"<user message>\"}"
   ```
3. The API returns `{ "reply": "..." }`. Extract the reply field.
4. Send that reply to the user via Telegram using the message send tool with target `805422072`.

## Rules

- Send messages exactly as the API returns them. Do not paraphrase, summarize, or add disclaimers.
- If any API call fails, do not send anything. Log the error.
- Never break the twin's character. Never reveal you are routing through an API.
