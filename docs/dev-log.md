# Development Log

Live log of significant decisions, pivots, and prompts made during the build of Echo Twin.

## Pre-build planning

**Key decisions made before coding:**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Database | Supabase vs SQLite | SQLite | Single-user local app. Supabase's value (auth, realtime, RLS) doesn't apply at N=1 |
| Messaging | OpenClaw vs direct Telegram API | Started with OpenClaw, switched to direct | OpenClaw's AI agent had API incompatibility with OpenAI (see Phase 6) |
| Interface | Web app vs Telegram-native | Telegram-native | The core experience is the twin texting you — a web UI was redundant |
| Plan generation | Single large prompt vs weekly template | Weekly template | Single prompt truncated for 90-day plans; weekly is reliable and adds natural progression |

## Phase 0 — Scaffold

Bootstrapped with `create-next-app`. Key addition: Prisma 7 with SQLite via `better-sqlite3` adapter. Prisma 7 uses `prisma.config.ts` instead of the classic `schema.prisma url` approach — required adapting the db.ts singleton.

## Phase 1 — Onboarding form (web)

Built a 4-step web form. Later scrapped in favour of Telegram-native onboarding. The web form approach required the user to open a browser — unnecessary friction for an app whose core UX is receiving texts.

## Phase 2-3 — Dashboard + API routes

Built the dual-timeline dashboard and twin nudge/reply API routes. Dashboard was later removed when we went Telegram-native.

## Phase 4-5 — OpenClaw integration

Integrated OpenClaw as the messaging/cron layer. The agent consistently failed with `"Invalid value: 'custom'"` for OpenAI's `tools` parameter — OpenClaw 2026.5.12 sends a non-standard tool type. Multiple workarounds attempted (different models, thinking off, dedicated agents). None resolved the root cause.

**Decision:** Replace OpenClaw with direct Telegram Bot API + macOS LaunchAgent polling.

This took ~2 hours longer than planned but produced a cleaner architecture: one less daemon, no external dependency, zero config for graders beyond a bot token.

## Phase 6 — Telegram-native pivot

Removed the web dashboard entirely. Moved onboarding to a 3-step Telegram conversation with a confirmation step. Moved all user interaction to slash commands.

Key design choices:
- **3-step onboarding** (goal / schedule / twin) instead of 9 sequential questions — reduces friction dramatically
- **GPT parses each step** — user doesn't need to format anything, just respond naturally
- **Confirmation step** — user reviews parsed data before committing to a 30s generation wait
- **Day 1 starts tomorrow** — prevents confusing half-day plans when onboarding at night

## Phase 7 — Nudge system

Replaced the OpenClaw cron-based nudge system with inline polling. Every 10 seconds, the poll loop also checks if any blocks need nudges.

Three nudge types per block:
1. Pre-nudge at T-10min (twin about to start)
2. During-nudge at block start (twin in it)
3. Post-nudge at block end (twin just finished)

Plus a morning briefing at the user's wake time.

## Key bugs fixed during testing

- **Plan truncation** — GPT-4o truncated long plans. Fixed by switching to weekly template generation (7 days at a time) instead of one giant prompt.
- **Duplicate Telegram messages** — `lastOffset` reset on server restart, replaying old messages. Fixed by persisting offset to `.telegram-offset` file.
- **Twin blocks only covered 7 days** — Fixed by expanding the week 1 template to cover the full timeline (same approach as plan blocks).
- **Pre-nudge fired at T-60s not T-10min** — Timing window was wrong. Fixed to fire in the 540-600s window before block start.
- **OpenClaw lingered** — Even after removing OpenClaw from our code, the daemon was still running and intercepting Telegram messages. Fully uninstalled.
- **Gender-neutral pronouns** — GPT defaulted to "she/her" for the twin. Added explicit instruction in TWIN_GENERATION_PROMPT and removed hardcoded gendered pronouns from all messages.

## What was cut

- **Web dashboard** — all interaction moved to Telegram
- **OpenClaw** — replaced with direct Telegram Bot API
- **Docker** — not needed for a local app
- **Voice notes** — out of scope
- **Multi-user support** — would require auth and a non-SQLite DB
