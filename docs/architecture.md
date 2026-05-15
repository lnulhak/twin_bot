# Architecture

## Overview

Echo Twin is a single-process local app. There is no web UI — everything happens through Telegram.

```
Telegram ←──── User's phone
    │
    ▼
Telegram Bot API (polling every 10s)
    │
    ▼
LaunchAgent (scripts/telegram-poll.sh)
    │  POST /api/telegram/poll
    ▼
Next.js API server (port 3000)
    │
    ├── onboarding state machine
    ├── plan + twin generation (OpenAI gpt-4o)
    ├── nudge generation (OpenAI gpt-4o-mini)
    ├── reply generation (OpenAI gpt-4o-mini)
    └── SQLite database (Prisma 7)
```

## Two processes

1. **Next.js server** (`npm run dev`) — the brain. Handles all business logic: onboarding, plan generation, nudge generation, message storage, slash commands.

2. **LaunchAgent** (installed via `launchctl`) — calls `POST /api/telegram/poll` every 10 seconds. This fetches new Telegram messages and also checks if any nudges need to fire.

## Why polling instead of webhooks

Telegram webhooks require a public HTTPS URL. The app is local-first (runs on your Mac) and Telegram can't reach `localhost`. Polling every 10 seconds has negligible overhead (~300 bytes/request, ~2.5MB/day) and avoids the need for a tunnel or deployment.

## Why no OpenClaw

The original spec used OpenClaw as the Telegram/cron integration layer. During development, OpenClaw's AI agent had an API incompatibility with OpenAI (`type: "custom"` tool type rejected). Rather than work around it indefinitely, we replaced it with:
- Direct Telegram Bot API calls (`fetch` to `api.telegram.org`)
- macOS LaunchAgent for the polling loop
- In-process nudge scheduling (checked on every poll tick)

This made the system simpler and removed an external dependency.

## Nudge timing

Every poll tick, `checkNudges()` runs. For each of today's blocks it checks:
- **T-10 min**: pre-nudge ("about to start X")
- **T+0**: during-nudge ("just started X")
- **T+durationMin**: post-nudge ("just finished X")

Each fires once per block per nudge type, tracked in the `Message.nudgeType` field.

## Plan generation

Plans are generated as weekly templates (7 days), then expanded to fill the full timeline:
- A new template is generated every 3 weeks to add progression
- Difficulty: foundation → build → peak → recovery
- Twin blocks mirror the same weekly template, offset 10-15 min earlier

## Database

Single SQLite file at `./echo-twin.db`. Single-user (User id=1 always). Prisma 7 with `better-sqlite3` adapter.
