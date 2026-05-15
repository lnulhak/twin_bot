"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlockedTime } from "@/lib/types";

const TWIN_NAME_SUGGESTIONS = ["Mira", "Kai", "Zoe"];
const TIMELINE_OPTIONS = [30, 60, 90] as const;

type Step = 1 | 2 | 3 | 4;

interface FormData {
  goal: string;
  whyItMatters: string;
  timelineDays: 30 | 60 | 90;
  dailyHours: number;
  wakeTime: string;
  sleepTime: string;
  blockedTimes: BlockedTime[];
  timezone: string;
  currentLevel: string;
  twinName: string;
  twinVibe: string;
}

const defaultTimezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
};

export default function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormData>({
    goal: "",
    whyItMatters: "",
    timelineDays: 30,
    dailyHours: 2,
    wakeTime: "07:30",
    sleepTime: "23:00",
    blockedTimes: [],
    timezone: defaultTimezone(),
    currentLevel: "",
    twinName: TWIN_NAME_SUGGESTIONS[0],
    twinVibe: "",
  });

  // Blocked times local editor state
  const [newBlock, setNewBlock] = useState<BlockedTime>({ label: "", startTime: "09:00", endTime: "17:00" });

  const set = (field: keyof FormData, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addBlockedTime = () => {
    if (!newBlock.label.trim()) return;
    set("blockedTimes", [...form.blockedTimes, { ...newBlock }]);
    setNewBlock({ label: "", startTime: "09:00", endTime: "17:00" });
  };

  const removeBlockedTime = (i: number) =>
    set("blockedTimes", form.blockedTimes.filter((_, idx) => idx !== i));

  const canAdvance = () => {
    if (step === 1) return form.goal.trim() && form.whyItMatters.trim();
    if (step === 2) return form.wakeTime && form.sleepTime && form.timezone;
    if (step === 3) return form.currentLevel.trim();
    if (step === 4) return form.twinName.trim() && form.twinVibe.trim();
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Onboarding failed");
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex gap-1 mb-6">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div key={s} className={`h-0.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-white" : "bg-zinc-700"}`} />
          ))}
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">
            {step === 1 && "What are you working toward?"}
            {step === 2 && "Your schedule"}
            {step === 3 && "Where are you starting from?"}
            {step === 4 && "Meet your twin"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Step {step} of 4</p>
        </div>

        <div className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Goal</label>
                <Input
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                  placeholder="e.g. Get strong at DSA for job interviews"
                  value={form.goal}
                  onChange={(e) => set("goal", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Why does this matter?</label>
                <Textarea
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                  placeholder="Be honest — this shapes your plan..."
                  rows={3}
                  value={form.whyItMatters}
                  onChange={(e) => set("whyItMatters", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Timeline</label>
                <div className="flex gap-2">
                  {TIMELINE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("timelineDays", t)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.timelineDays === t
                          ? "bg-white text-zinc-950 border-white"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {t} days
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">
                  Daily hours available: <span className="text-white font-semibold">{form.dailyHours}h</span>
                </label>
                <input
                  type="range" min={1} max={8} step={0.5}
                  value={form.dailyHours}
                  onChange={(e) => set("dailyHours", parseFloat(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="flex justify-between text-xs text-zinc-600"><span>1h</span><span>8h</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Wake time</label>
                  <Input type="time" value={form.wakeTime}
                    onChange={(e) => set("wakeTime", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white focus-visible:ring-zinc-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Sleep time</label>
                  <Input type="time" value={form.sleepTime}
                    onChange={(e) => set("sleepTime", e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white focus-visible:ring-zinc-500" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Timezone</label>
                <Input value={form.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                  placeholder="e.g. Asia/Singapore" />
              </div>

              {/* Blocked times */}
              <div className="space-y-2 pt-1">
                <label className="text-sm text-zinc-400">Blocked times <span className="text-zinc-600">(work, school, etc.)</span></label>
                {form.blockedTimes.map((bt, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                    <span className="text-sm text-white">{bt.label}</span>
                    <span className="text-sm text-zinc-400">{bt.startTime} – {bt.endTime}</span>
                    <button onClick={() => removeBlockedTime(i)} className="text-zinc-600 hover:text-white ml-3 text-xs">✕</button>
                  </div>
                ))}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Label (e.g. Work)"
                      value={newBlock.label}
                      onChange={(e) => setNewBlock((b) => ({ ...b, label: e.target.value }))}
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500 h-8 text-sm"
                    />
                  </div>
                  <Input type="time" value={newBlock.startTime}
                    onChange={(e) => setNewBlock((b) => ({ ...b, startTime: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-white focus-visible:ring-zinc-500 h-8 w-28 text-sm" />
                  <span className="text-zinc-600 text-sm pb-0.5">to</span>
                  <Input type="time" value={newBlock.endTime}
                    onChange={(e) => setNewBlock((b) => ({ ...b, endTime: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700 text-white focus-visible:ring-zinc-500 h-8 w-28 text-sm" />
                  <button
                    onClick={addBlockedTime}
                    disabled={!newBlock.label.trim()}
                    className="text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-2 h-8 disabled:opacity-30"
                  >+ Add</button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Tell me where you&apos;re starting from</label>
              <Textarea
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                placeholder="e.g. I know basic Python, no DSA. Comfortable with arrays but trees are weak."
                rows={5}
                value={form.currentLevel}
                onChange={(e) => set("currentLevel", e.target.value)}
              />
            </div>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Twin name</label>
                <div className="flex gap-2">
                  {TWIN_NAME_SUGGESTIONS.map((name) => (
                    <button key={name} onClick={() => set("twinName", name)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        form.twinName === name
                          ? "bg-white text-zinc-950 border-white"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >{name}</button>
                  ))}
                </div>
                <Input
                  placeholder="Or type your own..."
                  value={TWIN_NAME_SUGGESTIONS.includes(form.twinName as typeof TWIN_NAME_SUGGESTIONS[number]) ? "" : form.twinName}
                  onChange={(e) => set("twinName", e.target.value || form.twinName)}
                  onFocus={() => {
                    if (TWIN_NAME_SUGGESTIONS.includes(form.twinName as typeof TWIN_NAME_SUGGESTIONS[number])) set("twinName", "");
                  }}
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Their vibe (one line)</label>
                <Input
                  placeholder="e.g. chill but disciplined, lowercase texter"
                  value={form.twinVibe}
                  onChange={(e) => set("twinVibe", e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                />
              </div>
              <p className="text-xs text-zinc-600">
                {form.twinName || "Your twin"} will text you throughout the day about what they&apos;re working on — in character.
              </p>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <button onClick={() => setStep((s) => (s - 1) as Step)}
                className="text-sm text-zinc-500 hover:text-white transition-colors">
                ← Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canAdvance()}
                className="bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30">
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canAdvance() || loading}
                className="bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30">
                {loading ? "Generating your plan…" : "Let's go"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
