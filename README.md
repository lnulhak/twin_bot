# Echo Twin

> A digital-twin accountability app. You set a goal; your "twin" — a fictional peer pursuing the same plan, slightly ahead — texts you on Telegram throughout the day about what they're working on, in first person. Parasocial accountability instead of nagging notifications.

---

## Overview

### Problem

Students and self-directed learners pursuing multi-week goals (DSA prep, fitness, language learning) consistently fail around day 10-15 of a long plan. Existing tools fall into two buckets:

1. **Reminder apps** — push notifications that are easy to dismiss because there's no one on the other end
2. **AI coaches** — feel preachy, obviously a bot, create fatigue

What's missing: the feeling of a friend doing the same thing. People stick with gym routines when they have a workout buddy. Echo Twin reproduces that social parallel pressure — synthetically.

### What was built

- User onboards via Telegram in 3 messages (goal → schedule → twin setup)
- GPT-4o generates a 30/60/90-day plan as weekly templates with progressive difficulty
- A fictional "twin" is generated with a name, personality, and speech style
- The twin texts the user 3 times per block: 10 min before, at start, and at end
- A morning briefing arrives at the user's wake time with a casual overview of the day
- The user can reply to the twin anytime; twin responds in character
- Slash commands: `/today`, `/done`, `/streak`, `/twin`, `/plan`, `/reset`

---

## Demo

[90-second demo video](./assets/demo.mp4)

**Screenshots:**
- [Onboarding flow](./assets/screenshots/01-onboarding.png)
- [Daily nudges on Telegram](./assets/screenshots/02-nudges.png)
- [Slash commands](./assets/screenshots/03-commands.png)

---

## Technology Stack

### Backend
- **Next.js 15** (App Router, TypeScript) — API server only, no web UI
- **Prisma 7** with **SQLite** via `better-sqlite3` adapter — single local database
- **OpenAI SDK** — `gpt-4o` for plan + twin generation (structured outputs via Zod), `gpt-4o-mini` for nudges and replies

### Messaging
- **Telegram Bot API** — direct HTTP calls, no third-party library
- **macOS LaunchAgent** — polls Telegram every 10 seconds, triggers the Next.js server

### Validation
- **Zod** — schema validation for LLM structured outputs and request bodies

---

## Development Approach with AI

### Tools used

| Tool | Purpose |
|---|---|
| **Claude Code** | Primary co-developer. Wrote all application code, made architectural decisions, debugged integrations |
| **OpenAI gpt-4o** | Runtime: plan generation, twin generation, onboarding parsing |
| **OpenAI gpt-4o-mini** | Runtime: nudge messages, conversational replies, per-step onboarding validation |

### Key architectural decisions

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Interface | Web app + Telegram | Telegram-only | The core UX is receiving texts — a web UI adds friction without value |
| Messaging layer | OpenClaw vs direct API | Direct Telegram Bot API | OpenClaw's AI agent had an irrecoverable API incompatibility with OpenAI |
| Scheduling | External cron vs inline polling | Inline polling | Polling every 10s is negligible overhead and eliminates external dependencies |
| Plan generation | Single large prompt vs weekly templates | Weekly templates | Single prompts truncated for 90-day plans; weekly is reliable and adds natural progression |

### Key prompts

All prompts are in `src/lib/prompts.ts` and documented in `docs/prompts.md`. The four critical ones:

1. **`WEEK_TEMPLATE_PROMPT`** — generates a 7-day block schedule at a given difficulty level
2. **`TWIN_GENERATION_PROMPT`** — creates personality, speech style, and parallel schedule for the twin
3. **`NUDGE_*_PROMPT`** (pre/during/post) — three distinct nudge types per block, each from the twin's perspective
4. **`REPLY_PROMPT`** — keeps the twin in character during conversation

### What failed and what we learned

- **OpenClaw integration failed** — the agent used a non-standard tool type (`custom`) that OpenAI rejects. Replaced with direct API calls after ~2 hours debugging. Lesson: verify third-party agent compatibility before committing.
- **Plan truncation** — single prompt for 90-day plans hit token limits mid-JSON. Fixed by generating weekly templates and expanding them.
- **Gender-neutral pronouns** — GPT defaulted to "she/her" regardless of twin name. Required explicit instruction in the system prompt.

---

## Installation

### Prerequisites

- Node.js 22+
- A Telegram account
- An OpenAI API key

### Setup

```bash
git clone https://github.com/lnulhak/twin_bot.git
cd twin_bot
npm install
cp .env.example .env.local
# Edit .env.local — fill in OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
npx prisma migrate deploy
```

### Getting your credentials

**OpenAI API key:** https://platform.openai.com/api-keys

**Telegram bot token:**
1. Open Telegram, search @BotFather, send `/newbot`
2. Follow prompts, copy the token (looks like `1234567890:ABC...`)

**Telegram chat ID:**
1. Start the bot (send `/start`)
2. The bot will show your chat ID in the pairing message

### Running

```bash
npm run dev
```

Install the polling LaunchAgent (runs every 10 seconds, survives reboots):

```bash
launchctl load ~/Library/LaunchAgents/ai.echotwin.telegram-poll.plist
```

Send `/start` to your Telegram bot to begin onboarding.

### Resetting

```bash
bash scripts/dev-reset.sh
```

---

## Usage

**Onboard once:** Send `/start` to your bot. Answer 3 short messages. Review the confirmation. Reply "yes". Wait ~30 seconds.

**Daily flow:**
- At your wake time: morning briefing from your twin
- 10 min before each block: pre-nudge
- At block start: during-nudge
- At block end: post-nudge
- Text the bot anytime to talk to your twin in character

**Slash commands:**

| Command | What it does |
|---|---|
| `/today` | Today's blocks with status |
| `/done 2` | Mark block 2 complete (after it starts) |
| `/streak` | Current streak (all blocks must be done) |
| `/twin` | What your twin is doing right now |
| `/plan` | This week's overview |
| `/reset` | Wipe and start over |
| `/help` | All commands |

---

## Project Structure

```
twin_bot/
├── src/
│   ├── app/
│   │   ├── api/telegram/poll/   ← main handler: commands, nudges, onboarding
│   │   └── page.tsx             ← minimal status page
│   └── lib/
│       ├── db.ts                ← Prisma singleton
│       ├── llm.ts               ← OpenAI wrappers
│       ├── prompts.ts           ← all prompt templates
│       ├── telegram.ts          ← Telegram Bot API wrapper
│       ├── onboardingSession.ts ← multi-step onboarding state
│       └── types.ts             ← shared TypeScript types
├── prisma/schema.prisma         ← data model
├── tests/                       ← vitest smoke tests
├── docs/                        ← architecture, dev log, prompts
├── scripts/                     ← dev-reset, set-bot-commands, telegram-poll
└── data/sample-onboarding.json  ← example input for testing
```

---

## Reflection

### What worked

- **Telegram-native** was the right call. Removing the web UI simplified everything and focused the product on what it actually is: a texting experience.
- **Weekly template approach** for plan generation solved the token truncation problem and gave natural weekly progression for free.
- **3-step onboarding with confirmation** dramatically improved the experience — users see what GPT parsed before committing to the 30s generation wait.

### What failed

- **OpenClaw** took longer to debug than building the replacement. For a time-boxed build, integrating active-development third-party tooling is risky.
- **Gender-neutral pronouns** need explicit prompting — GPT defaults to gendered language without instruction.

### What's next

- Multi-user support (requires auth and a hosted DB)
- Voice notes from the twin
- Persistent twin memory across days
- Deploy so the app works when your laptop is closed

---

## License

MIT — see `LICENSE`

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
