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

export async function generateReply(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
  });
  return completion.choices[0].message.content ?? "";
}
