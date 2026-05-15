export type BlockType = "deep_work" | "review" | "rest" | "skill_practice";

export interface OnboardingInput {
  goal: string;
  whyItMatters: string;
  timelineDays: 30 | 60 | 90;
  dailyHours: number;
  wakeTime: string;
  sleepTime: string;
  currentLevel: string;
  timezone: string;
  twinName: string;
  twinVibe: string;
}

export interface PlanBlock {
  dayNumber: number;
  startTime: string;
  durationMin: number;
  type: BlockType;
  description: string;
}

export interface TwinBlockData {
  dayNumber: number;
  startTime: string;
  durationMin: number;
  type: BlockType;
  description: string;
  vibe: string;
}

export interface TwinData {
  personality: string;
  speechStyle: string;
  twinBlocks: TwinBlockData[];
}
