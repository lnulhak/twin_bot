import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { fillTemplate, PLAN_GENERATION_PROMPT, TWIN_GENERATION_PROMPT } from "./prompts";
import type { OnboardingInput, PlanBlock } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const PlanSchema = z.object({
  blocks: z.array(
    z.object({
      dayNumber: z.number(),
      startTime: z.string(),
      durationMin: z.number(),
      type: z.enum(["deep_work", "review", "rest", "skill_practice"]),
      description: z.string(),
    })
  ),
});

export const TwinSchema = z.object({
  personality: z.string(),
  speechStyle: z.string(),
  twinBlocks: z.array(
    z.object({
      dayNumber: z.number(),
      startTime: z.string(),
      durationMin: z.number(),
      type: z.enum(["deep_work", "review", "rest", "skill_practice"]),
      description: z.string(),
      vibe: z.string(),
    })
  ),
});

export async function generatePlan(input: OnboardingInput): Promise<PlanBlock[]> {
  const blockedTimesStr = input.blockedTimes.length
    ? input.blockedTimes.map((b) => `${b.label} (${b.startTime}–${b.endTime})`).join(", ")
    : "none";

  const prompt = fillTemplate(PLAN_GENERATION_PROMPT, {
    goal: input.goal,
    whyItMatters: input.whyItMatters,
    timelineDays: input.timelineDays,
    dailyHours: input.dailyHours,
    wakeTime: input.wakeTime,
    sleepTime: input.sleepTime,
    blockedTimes: blockedTimesStr,
    currentLevel: input.currentLevel,
    timezone: input.timezone,
  });

  const completion = await openai.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert at decomposing big goals into daily executable plans." },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(PlanSchema, "plan"),
    max_tokens: 8000,
  });

  const result = completion.choices[0].message.parsed;
  if (!result) throw new Error("Plan generation returned null");
  return result.blocks;
}

export async function generateTwin(
  input: OnboardingInput,
  userBlocks: PlanBlock[]
) {
  const prompt = fillTemplate(TWIN_GENERATION_PROMPT, {
    twinName: input.twinName,
    twinVibe: input.twinVibe,
    userPlan: JSON.stringify(userBlocks.slice(0, 50)),
  });

  const completion = await openai.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are creating a fictional twin character for an accountability app." },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(TwinSchema, "twin"),
    max_tokens: 8000,
  });

  const result = completion.choices[0].message.parsed;
  if (!result) throw new Error("Twin generation returned null");
  return result;
}

export async function generateNudge(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
  });
  return completion.choices[0].message.content ?? "";
}

const OnboardingValidationSchema = z.object({
  complete: z.boolean(),
  missing: z.array(z.string()),
});

const OnboardingParseSchema = z.object({
  goal: z.string().min(5),
  whyItMatters: z.string().min(5),
  timelineDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  dailyHours: z.number().min(1).max(8),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
  blockedTimes: z.array(z.object({ label: z.string(), startTime: z.string(), endTime: z.string() })),
  currentLevel: z.string().min(5),
  twinName: z.string().min(1),
  twinVibe: z.string().min(3),
});

export async function validateOnboardingReply(userReply: string): Promise<{ complete: boolean; missing: string[] }> {
  const completion = await openai.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Check if the user's reply has enough real information to answer ALL of these questions:
1. goal (what they want to achieve)
2. why it matters (motivation, reason)
3. timeline (30, 60, or 90 days)
4. daily hours available (1-8)
5. wake time and sleep time
6. current skill/fitness level
Return complete=true only if the reply genuinely addresses at least questions 1, 2, 3, 4, and 6.
If anything is clearly missing or the reply is too vague/short, return complete=false and list what's missing.`,
      },
      { role: "user", content: userReply },
    ],
    response_format: zodResponseFormat(OnboardingValidationSchema, "validation"),
  });
  return completion.choices[0].message.parsed ?? { complete: false, missing: ["couldn't parse your reply"] };
}

export async function parseOnboardingReply(userReply: string, timezone: string) {
  const completion = await openai.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Extract onboarding information from the user's reply.
- timelineDays must be 30, 60, or 90 — pick the closest if ambiguous
- wakeTime and sleepTime must be "HH:mm" 24h format. If not specified use 07:00 / 23:00
- dailyHours must be a number 1-8
- blockedTimes: array of {label, startTime "HH:mm", endTime "HH:mm"} — empty array if none
- twinName: if not specified, pick one of Mira, Kai, Zoe
- twinVibe: if not specified, infer from context
- timezone: ${timezone}`,
      },
      { role: "user", content: userReply },
    ],
    response_format: zodResponseFormat(OnboardingParseSchema, "onboarding"),
  });
  return completion.choices[0].message.parsed;
}

export async function generateReply(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
  });
  return completion.choices[0].message.content ?? "";
}
