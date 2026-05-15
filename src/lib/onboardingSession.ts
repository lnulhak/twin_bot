import fs from "node:fs";
import path from "node:path";
import type { BlockedTime } from "./types";

const SESSION_FILE = path.resolve(process.cwd(), ".onboarding-session.json");

export type OnboardingStep = "goal" | "schedule" | "twin" | "confirm" | "generating";

export interface OnboardingSession {
  step: OnboardingStep;
  goal?: string;
  whyItMatters?: string;
  timelineDays?: 30 | 60 | 90;
  dailyHours?: number;
  wakeTime?: string;
  sleepTime?: string;
  blockedTimes?: BlockedTime[];
  currentLevel?: string;
  twinName?: string;
  twinVibe?: string;
}

export function getSession(): OnboardingSession | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
  } catch { return null; }
}

export function saveSession(session: OnboardingSession) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

export function clearSession() {
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
}
