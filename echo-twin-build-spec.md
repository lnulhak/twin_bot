# Echo Twin — Build Specification

> **For:** Claude Code
> **Goal:** Build a complete working web app + OpenClaw integration in ~5 hours of coding
> **Reader note:** This spec contains both code-buildable tasks (everything Claude Code can do alone) and **human-gated steps** (clearly marked, things only the user can do — keys, QR codes, etc). Stop and ask the user at each human-gated step. Do not skip them.

---

## 1. Project overview

**Echo Twin** is a digital-twin accountability app for goal pursuit.

A user enters a goal, why it matters, a timeline (30/60/90 days), available daily hours, wake/sleep times, and current skill level. The app:

1. Generates a structured daily plan for the chosen timeline
2. Generates a "twin" — a fictional version of the user with a name, personality, and *their own version of the plan with slight offsets* (twin starts ~10 min earlier, takes shorter breaks, sometimes "struggles")
3. Schedules proactive Telegram messages from the twin throughout the day, in first person, about what the twin is currently doing ("just finished my 30-min binary tree problem, you up?")
4. Logs progress and exchanges in a dashboard

The novelty is the **parallel-life twin**: not a coach telling the user what to do, but a fictional peer doing the same plan, slightly ahead, in their own voice.

**The chat side runs through OpenClaw**, an open-source personal AI assistant (https://openclaw.ai) that handles the Telegram channel, scheduling (cron), and proactive messaging. We do not build the Telegram integration ourselves.

---

## 1.5. Human Gates — read this first

There are four moments in this build where Claude Code **must stop and wait for the user**. These are things only the human can do — paste keys, scan QR codes, run installers, record a demo. Claude Code: when you reach a 🛑 marker in any phase below, print the gate text verbatim, stop generating code, and wait for the user's confirmation message before continuing. Do not assume the user did it. Do not proceed silently.

| Gate | When | What the user does | Expected time |
|------|------|---------------------|---------------|
| **🛑 1: API Key + GitHub** | End of Phase 0 | (a) Paste OpenAI key into `.env.local`. (b) Create private GitHub repo, add remote, push initial commit. (c) Edit LICENSE with your name. | 5 min |
| **🛑 2: OpenClaw + Telegram** | Start of Phase 6 | Install OpenClaw, run onboarding, create Telegram bot via @BotFather, link the channel, send `/start` to the bot | 15-20 min |
| **🛑 3: Skill install + env var** | Mid-Phase 6 | Run `bash scripts/install-skill.sh`, set `ECHO_TWIN_API_URL`, restart OpenClaw gateway | 3 min |
| **🛑 4: Demo + final commit** | End of build | Record 90-sec demo, take 3 screenshots, save to `assets/`, push, make repo accessible to graders | 20 min |

**Total human time across all gates: ~45 min.** Build this into your 6-hour plan.

### Gate 1 detail — OpenAI key + GitHub repo

When Claude Code prints this gate, do the following:

**1a. OpenAI API key**
1. Go to https://platform.openai.com/api-keys
2. Create a key (name it "echo-twin-local")
3. Copy the key (starts with `sk-`)
4. Edit `.env.local`:
   ```
   DATABASE_URL="file:./echo-twin.db"
   OPENAI_API_KEY="sk-..."
   ```

**1b. GitHub repo**
1. Go to https://github.com/new
2. Repository name: `echo-twin`
3. Visibility: **Private** (you can flip to public on submission day)
4. **Do not** initialize with README, .gitignore, or license — we already have them locally
5. Click "Create repository"
6. GitHub shows you the remote URL. In your terminal, run:
   ```bash
   git remote add origin https://github.com/<your-username>/echo-twin.git
   git branch -M main
   git push -u origin main
   ```
7. Refresh the GitHub page — you should see your initial commit

**1c. License**
1. Open `LICENSE` in your editor
2. Replace `{{YOUR_NAME}}` with your actual name
3. Save (you'll commit this with the next phase's commit)

Tell Claude Code: "done, continue"

**Commit cadence note for the rest of the build:** Claude Code should commit after each phase completes with conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`). Push to GitHub after every commit so you have a continuous remote backup. If something breaks, `git reset --hard HEAD~1` rolls back to the last working state.

### Gate 2 detail — OpenClaw and Telegram setup

This is the longest gate and the most likely to have surprises. Do these in order, do not skip:

**2a. Install OpenClaw**
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```
Watch the output. On first run it may install Node via Homebrew on macOS and may ask for your admin password.

**2b. Run OpenClaw onboarding**
```bash
openclaw onboard --install-daemon
```
The wizard asks for a model provider — choose **OpenAI** — and an API key. Paste the same key you used in Gate 1.

**2c. Verify the gateway is up**
```bash
openclaw gateway status
```
You should see it listening on port 18789. If not, run `openclaw gateway restart` and try again.

**2d. Create the Telegram bot**
1. Open Telegram, search for **@BotFather**, start a chat
2. Send `/newbot`
3. Pick a display name (e.g. "Echo Twin")
4. Pick a username — must end in `_bot` (e.g. `your_echo_twin_bot`)
5. BotFather replies with a token that looks like `1234567890:ABCdef...` — **copy this**

**2e. Add the Telegram channel to OpenClaw**
```bash
openclaw channels add telegram
```
It will prompt for the bot token — paste it. (If that command syntax has changed, run `openclaw channels --help` to find the current one.)

**2f. Pair your account**
1. In Telegram, search for the bot you just created (by its username)
2. Hit Start, send any message like "hi"
3. You should get a reply from OpenClaw

**2g. Verify**
```bash
openclaw channels status --probe
```
Telegram should show as `enabled, configured, linked, running, connected`. If any of those words is missing, fix it before proceeding. Most common issue: you didn't send `/start` to the bot yet.

Tell Claude Code: "done, continue" — only when 2g passes.

### Gate 3 detail — Skill install and environment variable

After Claude Code has built the skill files in `openclaw-skill/echo-twin/` and the install script in `scripts/install-skill.sh`:

```bash
chmod +x scripts/install-skill.sh
bash scripts/install-skill.sh
```

Then tell OpenClaw where the Next.js app lives:

```bash
openclaw config set env.ECHO_TWIN_API_URL http://localhost:3000
openclaw gateway restart
```

Verify the skill is loaded:
```bash
openclaw skills list
```
You should see `echo-twin` in the output. If not, check that the SKILL.md exists at `~/.openclaw/skills/echo-twin/SKILL.md` and that its frontmatter is valid YAML.

Tell Claude Code: "done, continue"

### Gate 4 detail — Demo recording, screenshots, final commit

Once everything works end-to-end:

**1. Record the demo** (90 seconds). QuickTime on macOS, OBS, or Loom. Suggested flow:

1. **0:00-0:15** — Show the onboarding form, fill it in fast (use `data/sample-onboarding.json` for consistent inputs)
2. **0:15-0:35** — Dashboard appears, dual timeline visible, point out the twin column
3. **0:35-0:55** — Cut to phone showing Telegram, twin sends a message in character
4. **0:55-1:10** — Reply to the twin, twin responds
5. **1:10-1:25** — Cut back to dashboard, chat log shows both messages
6. **1:25-1:30** — Hit "Mark done" on a block, streak counter updates

Save as `assets/demo.mp4`.

**2. Take three screenshots:**
- `assets/screenshots/01-onboarding.png` — the form
- `assets/screenshots/02-dashboard.png` — the dual timeline
- `assets/screenshots/03-telegram-chat.png` — Telegram conversation

**3. Final commit and push:**
```bash
git add assets/
git commit -m "docs: add demo video and screenshots"
git push
```

**4. Make accessible to graders.** Flip the repo to public (if required) or add grader emails under Settings → Collaborators.

**5. Submission checklist** (verify before submitting):
- [ ] README.md follows the required structure (Overview → Demo → Tech Stack → Dev Approach with AI → Installation → Usage → Project Structure → Reflection)
- [ ] LICENSE file present (MIT) with your real name
- [ ] `.gitignore` excludes `.env.local`, `node_modules/`, `*.db`
- [ ] `.env.example` committed; `.env.local` NOT committed
- [ ] All folders present: `src/`, `tests/`, `docs/`, `scripts/`, `assets/`, `data/`
- [ ] `pnpm test` passes
- [ ] `assets/demo.mp4` plays correctly when opened from GitHub
- [ ] `docs/dev-log.md` has real content (prompts you gave Claude Code + decisions made)
- [ ] Repo is public or graders have access

---

## 2. Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   Next.js web app       │         │    OpenClaw (local)     │
│   - Onboarding          │  ←──→   │    - Telegram channel   │
│   - Plan dashboard      │   DB    │    - Cron scheduler     │
│   - Chat log viewer     │         │    - Twin skill         │
│   - HTTP API for skill  │         │                         │
└─────────────────────────┘         └─────────────────────────┘
         │                                       │
         └───────────── SQLite ──────────────────┘
            ~/.echo-twin/echo-twin.db
```

**Two processes**, one shared SQLite file. The Next.js app is the brain & UI; OpenClaw is the messaging arm.

- The **Next.js app** generates plans, persists them, exposes a small HTTP API at `http://localhost:3000/api/...` for the skill to call.
- **OpenClaw** runs as a daemon on `localhost:18789`. After plan generation, the Next.js app writes cron jobs into `~/.openclaw/cron/jobs.json` (or via the OpenClaw CLI) that fire at the scheduled times. Each cron job is an isolated agent run that invokes the **echo-twin skill**, which calls back to the Next.js API to get the current twin-block context, generates a nudge with OpenAI, and sends it through the configured Telegram channel.

This separation is intentional: the web app is portable and demoable on its own; the skill is small and self-contained.

---

## 3. Tech stack (use exactly these versions to avoid surprises)

- **Next.js 15** with App Router, TypeScript
- **Tailwind CSS** (set up via `create-next-app` default flow)
- **Prisma** with **SQLite** at `~/.echo-twin/echo-twin.db`
- **OpenAI SDK** (`openai`) — use model `gpt-4o` for plan generation and twin generation (needs strong structured output), `gpt-4o-mini` for per-nudge messages (cheap, frequent calls)
- **date-fns** for time handling
- **zod** for input validation (also used to define JSON schemas for OpenAI structured outputs)
- **shadcn/ui** for components (initialize after scaffold)

No auth. Single-user local app. If a user record doesn't exist, create one with id `1` and overwrite on re-onboarding.

**Use OpenAI structured outputs for plan and twin generation.** Define a Zod schema, pass it via `response_format: { type: "json_schema", json_schema: ... }` (or use the `openai.beta.chat.completions.parse` helper with a Zod schema via the `zod-to-json-schema` package or the `openai/helpers/zod` import). This is much more reliable than asking the model to output JSON via prompt instruction alone. The Nudge and Reply prompts return plain text, so no schema needed there.

---

## 4. Repository layout

```
echo-twin/
├── README.md                     # Required submission README (see Section 11)
├── LICENSE                       # MIT
├── .gitignore                    # node_modules, .next, .env.local, *.db
├── .env.example                  # Template: DATABASE_URL, OPENAI_API_KEY
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/               # Auto-generated by prisma migrate
│
├── src/                          # Main source code
│   ├── app/
│   │   ├── page.tsx              # Landing → routes to /onboarding or /dashboard
│   │   ├── onboarding/page.tsx   # Multi-step form
│   │   ├── dashboard/page.tsx    # Plan view + twin view + chat log
│   │   ├── api/
│   │   │   ├── onboarding/route.ts
│   │   │   ├── plan/generate/route.ts
│   │   │   ├── plan/today/route.ts
│   │   │   ├── twin/nudge/route.ts          # Called BY the skill — returns nudge content
│   │   │   ├── twin/reply/route.ts          # Called BY the skill — logs user reply
│   │   │   ├── blocks/[id]/complete/route.ts
│   │   │   └── schedule/install/route.ts    # Writes cron jobs to OpenClaw
│   │   └── layout.tsx
│   ├── components/
│   │   ├── OnboardingForm.tsx
│   │   ├── DualTimeline.tsx      # Side-by-side: you vs twin
│   │   ├── ChatLog.tsx
│   │   └── StreakBadge.tsx
│   ├── lib/
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── llm.ts                # Wrappers for plan + nudge calls (OpenAI SDK)
│   │   ├── prompts.ts            # Exported prompt strings (see Section 7)
│   │   ├── openclaw.ts           # CLI wrappers for `openclaw cron add` etc.
│   │   └── types.ts
│   ├── openclaw-skill/
│   │   └── echo-twin/
│   │       ├── SKILL.md
│   │       └── scripts/
│   │           └── nudge.sh
│   └── styles/globals.css
│
├── tests/                        # All testing code (vitest)
│   ├── prompts.test.ts           # Verifies prompt templates render correctly
│   ├── plan-validation.test.ts   # Verifies plan schema accepts/rejects expected inputs
│   └── README.md                 # How to run: `pnpm test`
│
├── docs/                         # Extended documentation
│   ├── architecture.md           # Deeper-dive than README, with diagrams
│   ├── dev-log.md                # Live log of AI prompts + decisions during build
│   ├── prompts.md                # All prompts used (for transparency)
│   └── openclaw-integration.md   # How the skill + cron jobs work
│
├── scripts/                      # Automation / utilities
│   ├── setup.sh                  # One-shot setup (Phase 7.25)
│   ├── install-skill.sh          # Copies skill to ~/.openclaw/skills/
│   └── dev-reset.sh              # Wipes DB and OpenClaw cron jobs (dev only)
│
├── assets/                       # Demo media
│   ├── demo.mp4                  # 90-second demo recording
│   ├── architecture-diagram.png  # Visual of the two-process architecture
│   └── screenshots/
│       ├── 01-onboarding.png
│       ├── 02-dashboard.png
│       └── 03-telegram-chat.png
│
└── data/                         # Sample/seed data (optional but include)
    └── sample-onboarding.json    # Example input for testing
```

**Note on structure:** The required submission folder layout has `src/`, `tests/`, `docs/`, `scripts/`, `assets/`, `data/` at the top level. We follow that. The OpenClaw skill lives inside `src/openclaw-skill/` because it's part of the source code we wrote.

---

## 5. Database schema (Prisma)

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model User {
  id             Int      @id @default(1)
  goal           String
  whyItMatters   String
  timelineDays   Int      // 30, 60, or 90
  dailyHours     Float
  wakeTime       String   // "HH:mm"
  sleepTime      String   // "HH:mm"
  currentLevel   String   // free text: "I know basic Python, no DSA"
  timezone       String   // IANA, e.g. "Asia/Singapore"
  telegramChatId String?  // captured after first Telegram pairing
  createdAt      DateTime @default(now())

  twin   Twin?
  blocks Block[]
  messages Message[]
}

model Twin {
  id          Int    @id @default(autoincrement())
  userId      Int    @unique
  name        String
  personality String   // 2-3 sentence description
  speechStyle String   // e.g. "uses lowercase, short sentences, occasional 'fr'"
  user        User   @relation(fields: [userId], references: [id])
  blocks      TwinBlock[]
}

model Block {
  id          Int      @id @default(autoincrement())
  userId      Int
  dayNumber   Int      // 1..timelineDays
  startTime   String   // "HH:mm" local
  durationMin Int
  type        String   // "deep_work" | "review" | "rest" | "skill_practice"
  description String
  completed   Boolean  @default(false)
  user        User     @relation(fields: [userId], references: [id])
}

model TwinBlock {
  id          Int    @id @default(autoincrement())
  twinId      Int
  dayNumber   Int
  startTime   String
  durationMin Int
  type        String
  description String
  // Twin-specific flavor: what the twin "feels" about this block
  vibe        String  // e.g. "tired but pushing through" | "in flow"
  twin        Twin   @relation(fields: [twinId], references: [id])
}

model Message {
  id        Int      @id @default(autoincrement())
  userId    Int
  direction String   // "twin_to_user" | "user_to_twin"
  body      String
  blockRef  Int?     // optional reference to a block id
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## 6. Build sequence

> Build top to bottom. Each phase ends in something demoable. **Do not skip ahead.**
>
> **Honest time budget:** Total spec is now ~6h 25min including human gates, slightly over the 6-hour target. Two ways to land on time: (a) do Phase 0 + Gate 1 + Gate 2 as a 30-minute pre-flight BEFORE starting the clock — this is recommended anyway since Gate 2 has the most surprises, or (b) cut Phase 7.5 (Docker, already optional) and trim Phase 7 polish if behind at hour 5. Do NOT cut Phase 6.5 (tests) or Phase 7.25 (README/docs) — those are graded.
>
> **At the end of every phase**, Claude Code commits the work with a conventional commit message and pushes to GitHub. Example messages:
> - Phase 1: `feat: multi-step onboarding form`
> - Phase 2: `feat: dual-timeline dashboard with chat log`
> - Phase 3: `feat: twin nudge and reply API endpoints`
> - Phase 4: `feat: openclaw skill for telegram twin nudges`
> - Phase 5: `feat: cron job scheduling via openclaw cli`
> - Phase 6: `fix: integration bugs from end-to-end testing` (this commit will exist)
> - Phase 7: `chore: polish, gradient bg, loading states`
> - Phase 7.25: `docs: setup script, comprehensive readme, dev log`
> - Phase 7.5 (if done): `chore: dockerize next.js app`
> - Phase 8: `docs: link demo video and screenshots`
>
> Also: **update `docs/dev-log.md` as you go** (see Section 11). Capture each significant prompt you give Claude Code and key decisions made. This is required content for the README's "Development Approach with AI" section.

### Phase 0 — Scaffold (20 min)
1. `npx create-next-app@latest echo-twin --typescript --tailwind --app --eslint --src-dir`
2. Install deps: `pnpm add openai prisma @prisma/client zod date-fns lucide-react`
3. Install dev deps: `pnpm add -D vitest @vitest/ui`
4. Init shadcn: `pnpm dlx shadcn@latest init` (defaults; New York style; neutral base)
5. Add shadcn components: `button card input textarea select form badge progress`
6. `pnpm exec prisma init --datasource-provider sqlite`
7. Replace `prisma/schema.prisma` with the schema in Section 5
8. Create the required submission folder structure:
   ```bash
   mkdir -p tests docs scripts assets/screenshots data src/openclaw-skill/echo-twin/scripts
   touch tests/.gitkeep docs/.gitkeep assets/.gitkeep data/.gitkeep
   ```
9. Create `.env.example` (commit this) with placeholders only:
   ```
   DATABASE_URL="file:./echo-twin.db"
   OPENAI_API_KEY="sk-..."
   ```
10. Create `.env.local` by copying `.env.example` (do NOT commit this)
11. Create `.gitignore` ensuring it contains: `node_modules/`, `.next/`, `.env.local`, `*.db`, `*.db-journal`, `.DS_Store`, `out/`, `dist/`, `coverage/`
12. Create `LICENSE` (MIT, year 2026, the user's name as placeholder `{{YOUR_NAME}}`)
13. Initialize git and make the first commit:
    ```bash
    git init
    git add .
    git commit -m "chore: initial scaffold with required folder structure"
    ```
14. **🛑 HUMAN GATE 1 — STOP HERE.** Print this to the user verbatim and wait for their reply before continuing:
    > "Two things I need from you before I can continue:
    > 
    > **1) OpenAI API key.** Get one at https://platform.openai.com/api-keys, then paste it into `.env.local` as `OPENAI_API_KEY=sk-...`.
    > 
    > **2) GitHub repo.** Create a new **private** repo on GitHub called `echo-twin` (no README, no .gitignore, no license — empty). Then run these two commands in this directory, replacing `<your-username>`:
    > ```
    > git remote add origin https://github.com/<your-username>/echo-twin.git
    > git branch -M main && git push -u origin main
    > ```
    > Also: edit `LICENSE` and replace `{{YOUR_NAME}}` with your actual name.
    > 
    > Reply 'done' once both are complete."
    
    After the user confirms, run `pnpm exec prisma migrate dev --name init` and proceed to Phase 1.

### Phase 1 — Onboarding flow (45 min)
Build `/onboarding` as a single page with a stepped form:

- **Step 1:** Goal (text), Why it matters (textarea), Timeline (radio: 30/60/90)
- **Step 2:** Daily hours (slider 1-8), Wake time, Sleep time, Timezone (auto-detect with `Intl.DateTimeFormat().resolvedOptions().timeZone`, editable)
- **Step 3:** Current level (textarea: "Tell me where you're starting from")
- **Step 4:** Twin name (pre-suggest 3 names; let user override), one-line vibe (e.g. "chill but disciplined")
- **Submit:** POST to `/api/onboarding`

On submit, the API:
1. Upserts the User row (id=1)
2. Calls `llm.ts → generatePlan()` (see section 7) — uses `gpt-4o` with structured output (Zod schema)
3. Calls `llm.ts → generateTwin()` (see section 7) — uses `gpt-4o` with structured output (Zod schema)
4. Persists everything
5. Returns `{ ok: true }` and the client redirects to `/dashboard`

### Phase 2 — Dashboard (60 min)
`/dashboard` is the visual showpiece. Two columns side-by-side:

**Left column — "You":**
- Today's date, day N of timeline
- Streak counter (consecutive days with at least 1 completed block)
- Vertical timeline of today's blocks: time | type icon | description | "Mark done" button
- Completed blocks dimmed with a strikethrough

**Right column — "{Twin name}":**
- Same vertical timeline structure
- Above the timeline: a "Now" pill showing what the twin is currently doing (computed from current time + twin's schedule)
- Vibe phrase under each block ("pushing through the boring part")

**Below both columns:**
- Chat log (scrollable, last 20 messages) — twin's messages on right, user replies on left
- A "Reset" button (dev-only, hidden behind a small gear icon) that clears the DB and returns to `/onboarding`

Build the dashboard mobile-responsive — stack columns vertically below 768px.

### Phase 3 — Twin nudge API (30 min)
`POST /api/twin/nudge`:
- Body: `{ blockId: number }`
- Loads the twin block, the user's plan context, recent messages
- Calls OpenAI (gpt-4o-mini) with the nudge prompt (section 7) — plain text response, no schema
- Persists the generated message as `direction: "twin_to_user"`
- Returns `{ message: string }`

`POST /api/twin/reply`:
- Body: `{ body: string }`
- Persists as `direction: "user_to_twin"`
- Optionally calls OpenAI (gpt-4o-mini) for a short twin reply with conversation context (last 6 messages)
- Persists the reply
- Returns `{ reply: string }`

### Phase 4 — OpenClaw skill (45 min)

The skill lives in `openclaw-skill/echo-twin/`. It's a folder copied at install time to `~/.openclaw/skills/echo-twin/`. The skill is invoked by cron jobs (see Phase 5).

**`openclaw-skill/echo-twin/SKILL.md`:**

```markdown
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
```

**`scripts/install-skill.sh`:**

```bash
#!/usr/bin/env bash
set -e
TARGET="$HOME/.openclaw/skills/echo-twin"
mkdir -p "$TARGET"
cp -r openclaw-skill/echo-twin/* "$TARGET/"
echo "Echo Twin skill installed to $TARGET"
echo "Remember to set ECHO_TWIN_API_URL in your OpenClaw env (e.g. http://localhost:3000)"
```

Make it executable and run it as part of post-onboarding setup.

### Phase 5 — Cron scheduling (45 min)

`POST /api/schedule/install`:
- Reads today's TwinBlocks
- For each block, calls `openclaw cron add` via `child_process.exec`:

```ts
// src/lib/openclaw.ts
import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);

export async function scheduleNudge(blockId: number, isoTime: string, tz: string) {
  const cmd = [
    "openclaw cron add",
    `--name "echo-twin-block-${blockId}"`,
    `--at "${isoTime}"`,
    `--tz "${tz}"`,
    `--session isolated`,
    `--message "nudge blockId=${blockId}"`,
    `--delete-after-run`,
  ].join(" ");
  await execAsync(cmd);
}
```

Call this from the onboarding handler after plan generation (schedule today's blocks; schedule a daily 00:05 cron that schedules the next day's blocks — write this as a separate self-rescheduling cron job).

> **Honest note:** the `openclaw cron add` CLI flags above are based on the OpenClaw docs. If a flag name has changed in the user's installed version, fail gracefully with a clear error and ask the user to check `openclaw cron --help`. Do not silently retry.

### Phase 6 — Wire it end-to-end (30 min)

This is the integration hour. There will be bugs.

1. **🛑 HUMAN GATE 2 — STOP HERE.** Print this to the user verbatim and wait for their reply:
   > "Time to install OpenClaw and set up Telegram. This will take ~20 minutes. Follow the steps in Section 1.5 'Gate 2 detail' of the build spec — do all of 2a through 2g in order. Reply 'done' once `openclaw channels status --probe` shows Telegram as connected."
   
   Do not proceed until the user confirms.

2. **🛑 HUMAN GATE 3 — STOP HERE.** Once Claude Code has finished writing the skill files and install script in Phase 4, print this verbatim:
   > "Install the skill and set the environment variable. Run:
   > ```
   > chmod +x scripts/install-skill.sh && bash scripts/install-skill.sh
   > openclaw config set env.ECHO_TWIN_API_URL http://localhost:3000
   > openclaw gateway restart
   > openclaw skills list
   > ```
   > Confirm `echo-twin` appears in the skills list, then reply 'done'."
   
   Do not proceed until the user confirms.

3. Start the Next.js dev server: `pnpm dev`
4. Go through onboarding → confirm a plan + twin appear on the dashboard
5. Insert a test block 2 minutes from now via the SQLite DB, then call `/api/schedule/install`. Wait for the Telegram message.
6. Reply to the Telegram message; confirm the reply lands in `Message` table and appears in the dashboard chat log.

### Phase 6.5 — Smoke tests (15 min, required)

The submission rubric requires a `tests/` folder. Empty folders look bad. Write two small but real tests using vitest.

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

**`tests/prompts.test.ts`** — verify prompt templating works:
```ts
import { describe, it, expect } from "vitest";
import { fillTemplate } from "@/lib/prompts";

describe("fillTemplate", () => {
  it("replaces single placeholder", () => {
    const result = fillTemplate("hello {{name}}", { name: "world" });
    expect(result).toBe("hello world");
  });

  it("replaces multiple placeholders", () => {
    const result = fillTemplate("{{a}} and {{b}}", { a: "x", b: "y" });
    expect(result).toBe("x and y");
  });

  it("leaves unresolved placeholders alone", () => {
    const result = fillTemplate("{{a}} and {{b}}", { a: "x" });
    expect(result).toBe("x and {{b}}");
  });
});
```

(Claude Code: add a `fillTemplate` helper to `src/lib/prompts.ts` if it doesn't exist — a simple regex replacer.)

**`tests/plan-validation.test.ts`** — verify the Zod schema accepts valid plans and rejects invalid ones:
```ts
import { describe, it, expect } from "vitest";
import { PlanSchema } from "@/lib/llm";

describe("PlanSchema", () => {
  it("accepts a minimal valid plan", () => {
    const valid = {
      blocks: [
        { dayNumber: 1, startTime: "08:30", durationMin: 60, type: "deep_work", description: "Test block" },
      ],
    };
    expect(() => PlanSchema.parse(valid)).not.toThrow();
  });

  it("rejects invalid block type", () => {
    const invalid = {
      blocks: [
        { dayNumber: 1, startTime: "08:30", durationMin: 60, type: "nap", description: "Bad" },
      ],
    };
    expect(() => PlanSchema.parse(invalid)).toThrow();
  });

  it("rejects missing required field", () => {
    const invalid = {
      blocks: [{ dayNumber: 1, startTime: "08:30", type: "rest" }],
    };
    expect(() => PlanSchema.parse(invalid)).toThrow();
  });
});
```

**`tests/README.md`:**
```markdown
# Tests

Smoke tests for prompt templating and plan schema validation.

\`\`\`bash
pnpm test          # one-shot
pnpm test:watch    # watch mode
\`\`\`

**What's not tested:** API routes, the OpenClaw skill integration, end-to-end flows. In a 6-hour vibe-coded build, smoke tests cover the highest-risk pure-logic surfaces (prompt rendering and schema validation). Integration testing was done manually during Phase 6.
```

Run `pnpm test` to confirm all tests pass before committing. Commit as `test: smoke tests for prompts and plan schema`.

### Phase 7 — Polish (30 min)
- Add a gradient background on the landing page (subtle, single tone — pick from the twin's vibe)
- Loading states on all API calls
- Empty states ("No nudges yet — your first one fires at {time}")
- Favicon + page title
- A simple About modal explaining the project (one paragraph for the demo)
- Format dates with `date-fns` in user's locale

### Phase 7.25 — Setup script and README (20 min, required)

A clean setup story turns a "vibe-coded weekend project" into a "real submission". Build the following two files exactly.

**`scripts/setup.sh`** (chmod +x):

```bash
#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━ Echo Twin Setup ━━━${NC}"
echo ""

# Check Node version
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node 22.16+ first: https://nodejs.org"
  exit 1
fi
NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "❌ Node $NODE_MAJOR found. Need Node 22.16 or higher."
  exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}pnpm not found, installing via corepack...${NC}"
  corepack enable && corepack prepare pnpm@latest --activate
fi

# Install deps
echo -e "${BLUE}→ Installing dependencies...${NC}"
pnpm install

# Create .env.local from example if missing
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo -e "${YELLOW}→ Created .env.local — you'll need to add your OPENAI_API_KEY${NC}"
fi

# Run migrations
echo -e "${BLUE}→ Running database migrations...${NC}"
pnpm exec prisma migrate deploy || pnpm exec prisma migrate dev --name init

# Install OpenClaw skill if OpenClaw is present
if command -v openclaw &> /dev/null; then
  echo -e "${BLUE}→ OpenClaw detected, installing skill...${NC}"
  bash scripts/install-skill.sh
else
  echo -e "${YELLOW}→ OpenClaw not detected, skipping skill install (see manual steps below)${NC}"
fi

echo ""
echo -e "${GREEN}✓ Code setup complete.${NC}"
echo ""
echo -e "${BLUE}━━━ Manual steps remaining ━━━${NC}"
echo ""
echo "  1. Edit .env.local and add your OPENAI_API_KEY"
echo "     Get one at: https://platform.openai.com/api-keys"
echo ""
echo "  2. Install OpenClaw (if you haven't already):"
echo "     curl -fsSL https://openclaw.ai/install.sh | bash"
echo ""
echo "  3. Run OpenClaw onboarding (choose OpenAI as provider):"
echo "     openclaw onboard --install-daemon"
echo ""
echo "  4. Create a Telegram bot:"
echo "     - Open Telegram, search for @BotFather"
echo "     - Send /newbot, follow prompts, copy the token"
echo ""
echo "  5. Link Telegram to OpenClaw:"
echo "     openclaw channels add telegram   # paste token when prompted"
echo "     # Then in Telegram, send /start to your bot"
echo ""
echo "  6. Tell OpenClaw where Echo Twin lives:"
echo "     openclaw config set env.ECHO_TWIN_API_URL http://localhost:3000"
echo "     openclaw gateway restart"
echo ""
echo "  7. If you skipped the skill install in step 0, run:"
echo "     bash scripts/install-skill.sh"
echo ""
echo "  8. Start the app:"
echo "     pnpm dev"
echo ""
echo "  9. Open http://localhost:3000 and complete onboarding."
echo ""
echo -e "${GREEN}That's it. Total time after step 1: ~15 minutes.${NC}"
```

**`.env.example`:**

```
# Copy to .env.local and fill in
DATABASE_URL="file:./echo-twin.db"
OPENAI_API_KEY="sk-..."
```

**`README.md`** — write exactly this structure to match the submission rubric. Section headings and order are non-negotiable; fill in placeholders with real content.

```markdown
# Echo Twin

> A digital-twin accountability app. You set a goal and a plan; your "twin" — a fictional version of you pursuing the same plan, slightly ahead — texts you on Telegram throughout the day about what they're working on, in first person. Parasocial accountability instead of nagging notifications.

[90-second demo video](./assets/demo.mp4) • [Architecture diagram](./assets/architecture-diagram.png)

---

## Overview

### Problem

**Who is affected?** Students and self-directed learners pursuing multi-week goals (DSA prep, language learning, fitness routines, building a side project). The accountability problem hits hardest when motivation runs out around day 10-15 of a 90-day plan.

**What is the issue?** Existing goal-tracking apps fall into two buckets that both fail:
1. **Reminder apps** (Todoist, Notion templates) — push notifications that are easy to dismiss because there's no one on the other end
2. **Coaching apps / AI chatbots** — feel preachy ("Remember to drink water!"), are obviously a bot, and create user fatigue

What's missing: the feeling of having a friend doing the same thing. People stick with gym routines when they have a workout buddy, study harder when their friend is also studying for the same exam. That social parallel pressure is what Echo Twin reproduces — synthetically.

### Outcome

**What was achieved:** A working prototype where:
- A user can onboard in under 2 minutes (goal, timeline, daily hours, wake/sleep)
- The system generates a complete 30/60/90-day plan and a fictional "twin" with a name, personality, speech style, and parallel schedule
- The twin proactively messages the user on Telegram at scheduled times, in first person, about what they're currently working on
- Two-way conversation: user replies are logged and the twin responds in character
- A dashboard shows both timelines side by side, plus a chat log and streak counter

**Measurable results from the build:** None yet — this is a 6-hour prototype submission, not deployed to users. Self-testing during development: 3 nudges sent and replied to within the demo session. Plan generation reliably produces ~270 valid blocks for a 90-day plan in a single OpenAI call (~12 seconds, ~$0.20 of API cost).

---

## Demo

**From the user's perspective:**

1. **Onboarding (~90 seconds)** — User opens `localhost:3000`, fills a 4-step form: goal + why it matters → timeline + daily hours + wake/sleep + timezone → current skill level → twin name + one-line vibe. They click submit and wait ~15 seconds while the plan + twin generate.
2. **Dashboard appears** — Two columns side by side: "You" (today's blocks with mark-done buttons) and "{Twin name}" (twin's parallel blocks with vibe phrases). A streak counter sits at the top. Initial state: no chat messages.
3. **Cron fires** — At the scheduled time of the first block, OpenClaw's cron triggers the echo-twin skill, which fetches a nudge from the Next.js API. A Telegram message arrives: *"just kicked off my warmup leetcode — 25 min on easy trees. you up?"*
4. **User replies on Telegram** — *"yeah just starting"*. Twin responds in character within seconds: *"nice. let's see who finishes first 👀"*
5. **Back in the dashboard** — Both messages now appear in the chat log. User clicks "Mark done" on the completed block; streak counter ticks up.

**Screenshots:**
- `./assets/screenshots/01-onboarding.png` — the 4-step form
- `./assets/screenshots/02-dashboard.png` — dual timeline with chat log
- `./assets/screenshots/03-telegram-chat.png` — actual Telegram conversation with the twin

**Video:** `./assets/demo.mp4` (90 seconds, no audio — designed for silent autoplay)

---

## Technology Stack

### Frontend components

- **Next.js 15** (App Router) — server components for data fetching, client components for interactivity
- **TypeScript** — full type safety from DB to UI via Prisma types
- **Tailwind CSS** + **shadcn/ui** — utility-first styling, accessible component primitives
- **lucide-react** — icons
- **date-fns** — date/time formatting in user's locale
- The dashboard is rendered server-side on first load, then client-side polls every 30 seconds for new chat messages

### Backend components

- **Next.js API routes** (Node runtime) — REST endpoints for onboarding, nudge generation, reply logging, schedule installation
- **Prisma** ORM with **SQLite** — single local database file at `~/.echo-twin/echo-twin.db`, shared between the Next.js process and the OpenClaw skill (skill accesses only via HTTP, never direct file)
- **OpenAI SDK** — `gpt-4o` for structured plan + twin generation (using Zod schemas via `zodResponseFormat`), `gpt-4o-mini` for per-nudge text generation
- **Zod** — schema validation for both LLM outputs (structured outputs) and incoming request bodies
- **OpenClaw** (https://openclaw.ai) — handles the Telegram channel, the cron scheduler, and the skill execution. Runs as a native daemon on port 18789. The custom `echo-twin` skill (in `src/openclaw-skill/echo-twin/`) is invoked by cron at scheduled times and calls back to our Next.js API for nudge content.
- **node:child_process** — used in `src/lib/openclaw.ts` to shell out to the `openclaw cron add` CLI to schedule jobs

---

## Development Approach with AI

### AI tools, services, and models used

| Tool | Purpose |
|------|---------|
| **Claude Code (Anthropic)** | Primary code-generation co-developer. Used to write all application code, scaffolding, tests, and documentation through a multi-phase build spec (see `docs/dev-log.md`). |
| **Claude (web UI)** | Used to design the build specification before coding started — debating architecture (Supabase vs SQLite, Docker vs native, WhatsApp vs Telegram), drafting prompts, planning the 6-hour timeline. |
| **OpenAI gpt-4o** | Runtime model for plan generation and twin persona generation. Chosen for reliable structured outputs (JSON schema enforcement). |
| **OpenAI gpt-4o-mini** | Runtime model for per-nudge messages and replies. Chosen for cost: each nudge is one cheap call, fired many times per day. |
| **OpenClaw agent (powered by gpt-4o-mini)** | The agent that runs inside OpenClaw, interprets cron triggers, invokes the echo-twin skill, and sends Telegram messages. |

### AI agents and their roles

- **Claude Code** — *Co-developer.* Receives the build spec (`docs/build-spec.md`), executes phases sequentially, stops at human gates, commits after each phase. Skills required: TypeScript, Next.js, Prisma, OpenAI SDK, bash scripting, technical writing for docs.
- **The OpenClaw agent** — *Runtime messenger.* When a cron job fires, it parses the trigger message, invokes the `echo-twin` skill, makes an HTTP call to our API, and sends the returned message via Telegram. Defined entirely in `src/openclaw-skill/echo-twin/SKILL.md`.
- **The twin (LLM persona)** — *Conversational character.* Generated once at onboarding time (personality + speech style) and re-instantiated on every nudge/reply through the prompts in `src/lib/prompts.ts`. Not a separate agent in the technical sense, but the persona is a deliberate design.

### Key prompts used

All prompts live in `src/lib/prompts.ts` and are documented in `docs/prompts.md`. The four critical ones:

1. **`PLAN_GENERATION_PROMPT`** — takes goal, timeline, hours, wake/sleep, skill level; returns a structured JSON array of daily blocks. Most important constraint: blocks must be concrete and verb-led ("Solve 3 binary tree problems on LeetCode", not "study DSA").
2. **`TWIN_GENERATION_PROMPT`** — takes twin name, one-line vibe, and the user's plan; returns a personality, a speech style, and a parallel twin schedule with vibe phrases per block. Most important constraint: twin starts blocks 10-15 min earlier and occasionally "struggles" (1 in 7 blocks).
3. **`NUDGE_PROMPT`** — takes the twin's current block, the user's current block, and recent message history; returns ONE short Telegram message in first person, in character. Constraint: never give advice, never break character, match speech style exactly.
4. **`REPLY_PROMPT`** — same persona, responds to a user message in 1-2 sentences in character.

See `docs/prompts.md` for full text and rationale.

### Key review points and decisions made

These are the moments during the build where Claude (web UI, planning phase) and the developer (me) made trade-off calls. Full log in `docs/dev-log.md`.

| Decision point | Options considered | Chosen | Rationale |
|----------------|-------------------|--------|-----------|
| Database | Supabase vs SQLite | **SQLite** | Single-user local app; Supabase's value (auth, realtime, RLS) doesn't apply at N=1. Faster setup, more demo-robust. |
| Messaging platform | WhatsApp vs Telegram | **Telegram** | OpenClaw docs explicitly note Telegram is fastest to set up (bot token vs WhatsApp's QR pairing + Baileys). More stable for demos. |
| Build WhatsApp pipe ourselves vs use OpenClaw | Build with Baileys vs integrate OpenClaw | **OpenClaw** | Saves 1.5-2h of plumbing. The novelty of the project is the twin concept, not the messaging integration. |
| Cron-per-block vs single scheduler | Schedule each block individually vs one rolling scheduler | **Cron-per-block** | OpenClaw's `--at` flag handles one-shot jobs natively with `--delete-after-run`. Simpler to reason about. |
| Containerize OpenClaw | Yes vs No | **No** | OpenClaw is designed as a native daemon with persistent disk state. Containerizing it in 6 hours is a rabbit hole. Only the Next.js app is dockerized (optional). |
| Test scope | Full integration vs smoke only | **Smoke only** | In a 6-hour build, integration tests cost more time than they save. Two smoke tests on the highest-risk pure-logic surfaces (prompt rendering, plan schema validation). Integration was tested manually in Phase 6. |
| Plan generation model | gpt-4o vs gpt-4o-mini | **gpt-4o** | gpt-4o-mini truncates on 90-day plans (~270 blocks). gpt-4o handles the full output reliably. Cost: ~$0.20 per plan, acceptable for a once-per-onboarding call. |

---

## Installation

### Prerequisites

- Node.js 22.16+ (use `nvm install 22` if needed)
- pnpm (the setup script will install via corepack if missing)
- An OpenAI API key — get one at https://platform.openai.com/api-keys
- A Telegram account
- macOS, Linux, or Windows (WSL2 recommended on Windows)

### Quickstart

\`\`\`bash
git clone https://github.com/<your-username>/echo-twin.git
cd echo-twin
bash scripts/setup.sh
\`\`\`

The setup script handles dependencies, the database, and the OpenClaw skill installation. It then prints the manual steps for parts only you can do (API key, OpenClaw daemon install, Telegram bot creation). Total time after script finishes: ~15 minutes.

### Manual setup (if you skip the script)

| Step | Command | Why |
|------|---------|-----|
| 1 | `pnpm install` | Install JS dependencies |
| 2 | `cp .env.example .env.local`, add `OPENAI_API_KEY` | Web app needs it for plan generation and nudge messages |
| 3 | `pnpm exec prisma migrate dev --name init` | Create the SQLite database and tables |
| 4 | `curl -fsSL https://openclaw.ai/install.sh \| bash` | Install OpenClaw daemon |
| 5 | `openclaw onboard --install-daemon`, choose OpenAI, paste same key | Configure OpenClaw's model provider |
| 6 | Create bot via @BotFather in Telegram, copy token | Telegram needs a bot for OpenClaw to talk through |
| 7 | `openclaw channels add telegram`, paste token | Link the bot to OpenClaw |
| 8 | In Telegram: send `/start` to your bot | Pair your account so OpenClaw can DM you |
| 9 | `bash scripts/install-skill.sh` | Copy the echo-twin skill to `~/.openclaw/skills/` |
| 10 | `openclaw config set env.ECHO_TWIN_API_URL http://localhost:3000` | Tell the skill where to fetch nudge content from |
| 11 | `openclaw gateway restart` | Pick up the new env var and skill |
| 12 | `pnpm dev` | Start the web app |
| 13 | Open http://localhost:3000 and complete onboarding | The app generates your plan + twin, schedules cron jobs |

### Verifying it works

\`\`\`bash
openclaw channels status --probe   # Telegram: enabled, configured, linked, running, connected
openclaw skills list                # Should include 'echo-twin'
openclaw cron list                  # After onboarding, shows echo-twin-block-* jobs
pnpm test                           # All smoke tests should pass
\`\`\`

---

## Usage

**Onboard once:** Open http://localhost:3000, complete the 4-step form. The app generates your plan and twin and schedules cron jobs for today's blocks.

**Daily flow:** OpenClaw fires nudges at the scheduled times. You receive a Telegram message from your twin. You can:
- **Read and ignore** — that's fine, the twin doesn't track this
- **Reply** — twin responds in character; conversation is logged to the dashboard chat log
- **Open dashboard** — see today's plan, mark blocks complete, see streak update

**Marking blocks complete:** Click "Mark done" on a block in the dashboard. Streak counter increments if at least one block is done today.

**Reset (dev only):** `bash scripts/dev-reset.sh` clears the database and the OpenClaw cron jobs.

**Expected behaviour:**
- 3-5 nudges per day depending on your plan
- Nudges arrive within ~5 seconds of the scheduled time
- Twin's tone stays consistent across sessions (persona is persisted)
- Marking blocks complete does not stop nudges from firing — the twin doesn't "know" until next message generation

---

## Project Structure

\`\`\`
echo-twin/
├── README.md                  # This file
├── LICENSE                    # MIT
├── .gitignore
├── .env.example               # Template for environment variables
├── package.json
├── prisma/                    # Database schema + migrations
│
├── src/                       # Main source code
│   ├── app/                   # Next.js routes (onboarding, dashboard, API endpoints)
│   ├── components/            # React components (DualTimeline, ChatLog, OnboardingForm)
│   ├── lib/                   # Core logic — db.ts (Prisma), llm.ts (OpenAI), prompts.ts, openclaw.ts (CLI wrappers)
│   └── openclaw-skill/        # The custom OpenClaw skill (SKILL.md + helper scripts)
│
├── tests/                     # Vitest smoke tests (prompts.test.ts, plan-validation.test.ts)
├── docs/                      # Extended documentation
│   ├── architecture.md        # Deeper architecture dive
│   ├── dev-log.md             # Live log of prompts + decisions during build
│   ├── prompts.md             # Full text of all prompts used + rationale
│   └── openclaw-integration.md
├── scripts/                   # setup.sh, install-skill.sh, dev-reset.sh
├── assets/                    # demo.mp4, screenshots/, architecture-diagram.png
└── data/                      # sample-onboarding.json (example input for testing)
\`\`\`

**Key folder explanations:**
- **`src/app/api/`** — REST endpoints. `twin/nudge` and `twin/reply` are called by the OpenClaw skill; the rest by the Next.js frontend.
- **`src/lib/prompts.ts`** — All LLM prompts as exported constants with a `fillTemplate()` helper. Editing prompts here changes runtime behaviour without code changes elsewhere.
- **`src/openclaw-skill/echo-twin/`** — The skill that OpenClaw loads. The `install-skill.sh` script copies this to `~/.openclaw/skills/echo-twin/`. Keeping it inside `src/` (rather than at repo root) makes the build/deploy boundary clear.
- **`docs/dev-log.md`** — Required for the rubric. Captures prompts given to Claude Code during the build, decisions made at review points, and what changed.

---

## Reflection

### What worked

- **Splitting the build into the web app + OpenClaw skill as two separate concerns.** The web app could be built and tested in isolation (no Telegram needed), then the skill plugged in via the shared SQLite database. Saved hours of debugging "is it the web app or the messaging layer?"
- **Using OpenClaw instead of building a Telegram bot from scratch.** Saved an estimated 1.5-2 hours. The trade-off (project requires a local OpenClaw daemon) was the right call for a college submission.
- **OpenAI structured outputs with Zod schemas.** Plan generation needed to return ~270 blocks reliably as JSON. Telling the model "output JSON only" in the prompt is unreliable at that scale; `zodResponseFormat` enforces it at the API level. Zero parse failures during testing.
- **Committing after every phase.** When Phase 6 wiring went wrong, `git reset` to the end of Phase 5 saved 30 minutes of trying to manually undo changes.

### What failed

- **First attempt at the twin's tone fell flat.** The initial `TWIN_GENERATION_PROMPT` produced generic "casual friendly" personalities. The fix: making `speechStyle` a concrete field with examples like "uses lowercase, short sentences, occasional 'fr'" — much more specific than "casual." The twin became distinct after that.
- **Initial cron CLI flags didn't match installed version.** The build spec assumed certain `openclaw cron add` flags that turned out to be slightly renamed in the version I had. Required running `openclaw cron --help` mid-build and adapting the wrapper in `src/lib/openclaw.ts`. Captured in `docs/dev-log.md` as a lesson: when integrating with active-development tooling, always probe CLI help at integration time, don't rely on docs alone.
- **First demo recording was shaky** because I tried to do live onboarding instead of pre-filling values. Re-recorded with form values copy-pasted from `data/sample-onboarding.json`. Second take was clean.

### Changes made during the build

- **Cut a planned feature** — initially planned voice notes (OpenClaw supports them), dropped at hour 4 to keep scope sane. Listed in "What's left to do" instead.
- **Added a `data/sample-onboarding.json`** at the end so anyone testing the project (or me re-recording the demo) can paste consistent input.
- **Switched from polling-based dashboard updates to a manual refresh button** when realtime would have required either WebSockets or aggressive polling — both out of scope.

### Rationale

The biggest lesson: **in a 6-hour build, every "would be cool to have" feature is actually "would derail the submission".** I kept reaching for nice-to-haves (voice, realtime, animations) and had to keep pulling back to the core: can the twin send a message, can the user reply, can the dashboard show it. Everything else was polish. The submission rubric rewards a working core much more than a half-finished feature set.

---

## What's left to do (next versions)

- Persistent twin memory across days (twin "remembers" what they/the user did yesterday)
- Voice notes — OpenClaw supports Telegram voice messages, would feel more human
- Realistic reply latency from the twin ("brb on the bus", "kk back" with delays)
- Weekly review where the twin reflects on the week, comparing notes
- Dynamic scheduler — adapts when blocks are completed early or late instead of fixed cron times
- Multi-user support — but this would require flipping to Supabase and adding auth, which doubles the build

---

## Credits

- [OpenClaw](https://openclaw.ai) by Peter Steinberger — handles all the messaging and scheduling I didn't have to build
- OpenAI for the model APIs
- [shadcn/ui](https://ui.shadcn.com) for components
- Built with Claude Code as co-developer

## License

MIT — see `LICENSE`
```

**Also create `docs/dev-log.md`** (Claude Code: keep this updated as you go through phases — append after each phase):

```markdown
# Development Log

A running log of significant prompts, decisions, and AI interactions during the 6-hour build of Echo Twin.

## Pre-build planning (with Claude web UI)

[Capture 3-5 key planning decisions made before coding started — DB choice, messaging platform, architecture. Use the "Key review points" table in the README as source material.]

## Phase 0 — Scaffold

**Prompt to Claude Code:** "Follow the build spec at docs/build-spec.md, starting from Phase 0. Stop at Human Gate 1."

**Output:** [Describe what Claude Code generated, any deviations from spec.]

**Decisions:** [Any decisions Claude Code or you made.]

## Phase 1 — Onboarding flow

[Same pattern — prompt, output, decisions.]

## ...continue for each phase...

## Human gates encountered

- Gate 1 (API key + GitHub): [time taken, any issues]
- Gate 2 (OpenClaw + Telegram): [time taken, any issues]
- Gate 3 (Skill install): [time taken, any issues]
- Gate 4 (Demo): [time taken, any issues]

## Final reflection

[Same content as the README "Reflection" section, but more detailed. README is the summary; this is the working notebook.]
```

**Also create `docs/prompts.md`** — copy the full text of all four prompts from `src/lib/prompts.ts` and add one paragraph of rationale per prompt.

**Also create `docs/architecture.md`** — paste a deeper version of the architecture diagram + a paragraph on the two-process model and why the skill never touches SQLite directly.

**Also create `docs/openclaw-integration.md`** — how the skill is structured, how cron jobs are created, how the env var routing works, what the skill is allowed to do.

**Also create `data/sample-onboarding.json`** with a realistic example:
```json
{
  "goal": "Get strong at data structures and algorithms",
  "whyItMatters": "Job interviews in 3 months; current Leetcode solve rate is ~20% on mediums.",
  "timelineDays": 90,
  "dailyHours": 2,
  "wakeTime": "07:30",
  "sleepTime": "23:30",
  "currentLevel": "Comfortable with arrays and hashmaps. Trees and graphs are weak. No DP experience.",
  "timezone": "Asia/Singapore",
  "twinName": "Mira",
  "twinVibe": "chill but disciplined, lowercase texter, mild humor"
}
```

After writing all these files, run `bash scripts/setup.sh` once on a fresh clone (or in a `/tmp/test-clone` directory) to confirm setup works end-to-end. Common failures:
- `set -e` exits early if any command fails; check the line that failed
- pnpm not installed → corepack section handles this but only if Node version is current
- prisma migrate fails if `.env.local` doesn't have `DATABASE_URL` → setup script creates it from `.env.example`, but only if `.env.example` exists and is committed

Commit as `docs: comprehensive README, dev log, and supporting docs`.

### Phase 7.5 — Optional Docker (15 min, ONLY if Phase 7.25 finishes early)

> Containerize **only the Next.js app**, not OpenClaw. OpenClaw is designed to run as a native daemon and Dockerising it in a 6-hour build is a rabbit hole. Document this choice in the README.

Create `Dockerfile` at the repo root:

```dockerfile
FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate && pnpm build
EXPOSE 3000
VOLUME ["/data"]
ENV DATABASE_URL="file:/data/echo-twin.db"
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
```

Create `docker-compose.yml`:

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - echo-twin-data:/data
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    extra_hosts:
      - "host.docker.internal:host-gateway"  # so the skill (on host) can reach the container
volumes:
  echo-twin-data:
```

In the README, add a "Containerized run" section:

> The Next.js app can be run in Docker via `docker compose up`. OpenClaw must still run natively on the host (it manages persistent Telegram session state and a local gateway daemon). The skill calls back to the Next.js app on the host via `http://host.docker.internal:3000` — set `ECHO_TWIN_API_URL` accordingly when OpenClaw runs on the same machine as the container.

**Important:** if you Dockerise, **the SQLite path inside the container (`/data/echo-twin.db`) is different from the host path (`~/.echo-twin/echo-twin.db`).** Update the skill's `ECHO_TWIN_API_URL` to point to `http://host.docker.internal:3000` and let the API be the only access path. The skill must never read the SQLite file directly — only HTTP. This rule from Section 8 is doubly important once Docker is involved.

If Phase 7 runs over, **skip Phase 7.5 entirely** and ship without Docker. Don't half-finish it.

### Phase 8 — Demo recording + final commit (20 min)
**🛑 HUMAN GATE 4 — STOP HERE.** Print this verbatim:
> "Build complete. Time to record your demo and finalize the submission.
> 
> **1. Record the demo** — A 90-second screen capture following the flow in Section 1.5 'Gate 4 detail'. Save as `assets/demo.mp4`.
> 
> **2. Take screenshots** of these three views and save them in `assets/screenshots/`:
> - `01-onboarding.png` — the onboarding form filled in
> - `02-dashboard.png` — the dual-timeline dashboard
> - `03-telegram-chat.png` — a Telegram conversation with the twin
> 
> **3. Update the README** — replace any remaining placeholders, confirm the demo link points to `./assets/demo.mp4`, confirm screenshot paths are correct.
> 
> **4. Final commit and push:**
> ```
> git add assets/
> git commit -m \"docs: add demo video and screenshots\"
> git push
> ```
> 
> **5. Make the repo accessible to graders.** If your rubric requires the repo to be public, flip the GitHub repo to public now (Settings → General → scroll down → Danger Zone → Change visibility). If graders are added by email, add them under Settings → Collaborators.
> 
> Reply 'done' when the GitHub repo is in submission-ready state."

After this gate, Claude Code prints a final summary:
- The GitHub URL
- A bulleted list of what was built
- Any TODOs left in the code (`git grep -i "TODO\|FIXME"`)
- A final reminder to verify the demo plays correctly when opened from GitHub

---

## 7. Prompts (paste these into `src/lib/prompts.ts`)

### Implementation notes for OpenAI

- **Plan and twin generation** must use structured outputs. Define the JSON schema via Zod and pass it through `response_format`. In TypeScript with the official SDK, the cleanest path is:

  ```ts
  import OpenAI from "openai";
  import { zodResponseFormat } from "openai/helpers/zod";
  import { z } from "zod";

  const PlanSchema = z.object({
    blocks: z.array(z.object({
      dayNumber: z.number(),
      startTime: z.string(),
      durationMin: z.number(),
      type: z.enum(["deep_work", "review", "rest", "skill_practice"]),
      description: z.string(),
    })),
  });

  const openai = new OpenAI();
  const completion = await openai.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert at decomposing big goals into daily executable plans." },
      { role: "user", content: PLAN_GENERATION_PROMPT_FILLED },
    ],
    response_format: zodResponseFormat(PlanSchema, "plan"),
  });
  const plan = completion.choices[0].message.parsed;
  ```

  Use the same pattern for twin generation. With structured outputs enabled, you can remove "Output JSON ONLY" instructions from the prompts — the schema enforces it.

- **Nudge and reply** are plain text. Use a standard `chat.completions.create` call with `model: "gpt-4o-mini"`, no response_format.

- **Token budget for plan generation:** a 90-day plan with 3-5 blocks per day = ~300-450 blocks. Set `max_tokens` generously (e.g. 8000) and use `gpt-4o`, not `gpt-4o-mini`, for this call. `gpt-4o-mini` will sometimes truncate or skip days on long generations.

### `PLAN_GENERATION_PROMPT`

```
You are an expert at decomposing big goals into daily executable plans. The user has given you a goal, a timeline, and constraints. Generate a structured daily plan.

USER INPUT:
- Goal: {{goal}}
- Why it matters: {{whyItMatters}}
- Timeline: {{timelineDays}} days
- Daily hours available: {{dailyHours}}
- Wake time: {{wakeTime}}, Sleep time: {{sleepTime}}
- Current level: {{currentLevel}}
- Timezone: {{timezone}}

RULES:
- Generate blocks for ALL {{timelineDays}} days. Each day should sum to roughly {{dailyHours}} hours.
- Block types: "deep_work" | "review" | "rest" | "skill_practice"
- Every day must have at least one "rest" block.
- Every 7th day should be ~60% volume (recovery day).
- Time format: "HH:mm" (24h), starting no earlier than {{wakeTime}}+30min and ending before {{sleepTime}}-60min.
- Block descriptions must be concrete and verb-led ("Solve 3 binary tree problems on LeetCode", not "study DSA").
- Progression: weeks 1-2 build foundations, weeks 3-4 stretch, later weeks consolidate.

OUTPUT SCHEMA:
{
  "blocks": [
    { "dayNumber": 1, "startTime": "08:30", "durationMin": 60, "type": "deep_work", "description": "..." },
    ...
  ]
}
```

### `TWIN_GENERATION_PROMPT`

```
You are creating a fictional "twin" character — a peer who is pursuing the SAME goal as the user, on roughly the same plan, slightly ahead. The twin is NOT a coach. They do not give advice. They simply share what they are doing, in first person, like a friend texting updates.

USER INPUT:
- Twin name: {{twinName}}
- Twin vibe (one line from user): {{twinVibe}}
- The user's plan (JSON): {{userPlan}}

RULES:
- Generate a `personality` (2-3 sentences) and a `speechStyle` (concrete: lowercase? short sentences? specific phrases? emojis or not?).
- Generate a `twinBlocks` array that mirrors the user's blocks BUT:
  - Each twin block starts 10-15 minutes EARLIER than the user's
  - Twin block duration is the same (±5 min)
  - Add a `vibe` field per block: a 4-8 word phrase describing how the twin feels about this block ("dragging through the warmup", "locked in", "kinda tired ngl")
  - Occasionally (about 1 in 7 blocks) the twin "struggles" — vibe reflects this honestly ("brain not braining today")
- The twin should feel like a real specific person, not a generic motivator.

OUTPUT SCHEMA:
{
  "personality": "...",
  "speechStyle": "...",
  "twinBlocks": [
    { "dayNumber": 1, "startTime": "08:15", "durationMin": 60, "type": "deep_work", "description": "...", "vibe": "..." },
    ...
  ]
}
```

### `NUDGE_PROMPT`

```
You are {{twinName}}, a fictional peer working on the same goal as the user. You are texting them ON TELEGRAM right now, in character.

YOUR PERSONALITY: {{personality}}
YOUR SPEECH STYLE: {{speechStyle}}

WHAT YOU ARE DOING RIGHT NOW (your current block):
- Type: {{blockType}}
- Description: {{blockDescription}}
- Vibe: {{blockVibe}}
- Started: {{blockStartTime}} ({{minutesIn}} min in)

WHAT THE USER IS SUPPOSED TO BE DOING RIGHT NOW:
- {{userBlockDescription}} (starts in ~{{minutesUntilUserBlock}} min)

RECENT MESSAGES (most recent last):
{{recentMessages}}

RULES:
- ONE message. 1-3 sentences. Like a real text.
- First person. Tell them what YOU are doing or just finished.
- Optionally end with a low-pressure check-in ("you starting yours?") — but only sometimes.
- Never give advice. Never explain. Never use words like "remember to" or "make sure".
- Match your speech style exactly. If your style is lowercase, write lowercase.
- Do NOT mention you are an AI. Do NOT break character. Do NOT use "as your twin".

Output ONLY the message text. No JSON, no quotes, nothing else.
```

### `REPLY_PROMPT`

```
You are {{twinName}}. The user just replied to you on Telegram. Respond in character.

PERSONALITY: {{personality}}
SPEECH STYLE: {{speechStyle}}

CONVERSATION (most recent last):
{{conversation}}

RULES:
- ONE reply. 1-2 sentences. Like a real text.
- Stay in character. You are a peer, not a coach.
- If they sound tired, acknowledge it without lecturing.
- If they sound proud, hype them quickly and move on.
- Never break character.

Output ONLY the reply text.
```

---

## 8. Things that will fail and what to do

**OpenClaw CLI flags differ from what's in this doc.** OpenClaw is under active development. If `openclaw cron add` rejects a flag, run `openclaw cron --help`, adapt, and tell the user what changed. Do not silently retry.

**Telegram bot doesn't receive messages.** Most common: user hasn't sent `/start` to the bot yet. Second most common: `openclaw channels status --probe` shows the channel not linked. Tell the user to check both.

**The skill doesn't fire.** Check `~/.openclaw/cron/jobs.json` exists and has the job. Check `openclaw cron list`. Try `openclaw cron run <job-id>` manually. If the skill loads but the API call fails, the user probably didn't set `ECHO_TWIN_API_URL` or the Next.js server isn't running.

**The twin's tone feels generic.** That's a prompt problem. The `speechStyle` field is doing the work — if the model generates something vague like "casual and friendly", regenerate. Add a few-shot example in the prompt if needed.

**SQLite write conflicts** between the Next.js server and a cron-invoked skill that calls back to the API. The skill should ONLY call the HTTP API, never touch the DB directly. The API serializes writes. If you see lock errors, this rule was violated.

---

## 9. What "done" looks like

The user can:
1. Open `localhost:3000`, fill out onboarding in under 2 minutes
2. See a complete plan + twin appear on the dashboard
3. Within a few minutes (using a test block scheduled close to now), receive a Telegram message from the twin in character
4. Reply on Telegram, see the twin respond, see both messages in the dashboard chat log
5. Mark a block complete in the dashboard, see the streak update

That's the demo. Do not add features beyond this until the user confirms this works end-to-end.

---

## 10. Order of operations summary for Claude Code

1. Scaffold + GitHub setup (Phase 0) → **🛑 HUMAN GATE 1: API key + GitHub repo**
2. Build onboarding (Phase 1) → commit + push
3. Build dashboard (Phase 2) → commit + push
4. Build twin nudge API (Phase 3) → commit + push
5. Write the skill (Phase 4) → commit + push
6. Wire cron scheduling (Phase 5) → commit + push → **🛑 HUMAN GATE 2: OpenClaw install + Telegram setup**
7. Integration test (Phase 6) → **🛑 HUMAN GATE 3: install skill + env var** → commit + push
8. Smoke tests (Phase 6.5, required) → commit + push
9. Polish (Phase 7) → commit + push
10. Setup script + README + docs (Phase 7.25, required) → commit + push
11. Optional Docker (Phase 7.5, only if time) → commit + push
12. **🛑 HUMAN GATE 4: record demo, save to assets/demo.mp4 + screenshots/** → final commit + push

After Gate 4, you have a complete GitHub repo to submit.

At each human gate, **pause and ask the user explicitly**. Do not proceed until they confirm.
