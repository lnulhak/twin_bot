---
name: echo-twin
description: Send a proactive twin-persona nudge to the user via Telegram when a scheduled block begins. Trigger this when a cron job fires with a blockId in the message.
metadata:
  openclaw:
    requires:
      env:
        - ECHO_TWIN_API_URL
      bins:
        - curl
      primaryEnv: ECHO_TWIN_API_URL
---

# Echo Twin Nudge

When triggered by a cron job, the message will contain a block id. Your job:

1. Parse the block id from the incoming message (format: `nudge blockId=<N>`).
2. Call the Echo Twin API to get the nudge content:
   ```
   curl -s -X POST "$ECHO_TWIN_API_URL/api/twin/nudge" \
     -H "Content-Type: application/json" \
     -d "{\"blockId\": <N>}"
   ```
3. The API returns `{ "message": "..." }`. Extract the message field.
4. Send that message verbatim to the user via the Telegram channel. Use the channel's send message tool. Do NOT add any preamble or commentary.

## Rules

- Send the message exactly as the API returns it. Do not paraphrase, summarize, or add disclaimers.
- If the API call fails, do not send anything. Log the error.
- Only act when the message clearly contains `nudge blockId=`. Ignore anything else.
