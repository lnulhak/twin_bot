# Prompts

All prompt templates live in `src/lib/prompts.ts`. They use `{{variable}}` placeholders filled by `fillTemplate()`.

## WEEK_TEMPLATE_PROMPT

Used for plan generation. Called once per 3-week segment. Generates 7 days of blocks.

Key constraints:
- Max 3 blocks per day
- Max 6 words per description
- Never overlap blocked times
- Day 7 is recovery (60% volume)
- Difficulty label (foundation/build/peak/recovery) shifts week-by-week

## TWIN_GENERATION_PROMPT

Generates the twin persona and their version of week 1's blocks. The week 1 template is then expanded to cover the full timeline.

Key constraints:
- Twin starts each block 10-15 min earlier than the user
- Vibe phrases: 4-6 words per block
- ~1 in 7 blocks the twin "struggles"
- Gender-neutral language throughout

## MORNING_BRIEFING_PROMPT

Fires at the user's wake time. Casual text summarising the day — not a formal list.

## NUDGE_PRE_PROMPT

Fires 10 minutes before a block starts. Twin mentions they're about to start too. Low-pressure heads-up.

## NUDGE_DURING_PROMPT

Fires at block start. Twin is in it. Optionally checks if user is starting.

## NUDGE_POST_PROMPT

Fires at block end. Twin just finished. Asks how it went.

## REPLY_PROMPT

Used for all conversational replies. Twin responds in character, in 1-2 sentences. No advice, no coaching.

## Parsing prompts (onboarding)

Three separate GPT-4o-mini calls parse each onboarding step:
- `parseGoalStep` — extracts goal, why, timeline
- `parseScheduleStep` — extracts hours, wake/sleep, blocked times
- `parseTwinStep` — extracts current level, twin name/vibe

Each returns `ok: boolean` and `missing: string[]` so the app can give specific feedback.
