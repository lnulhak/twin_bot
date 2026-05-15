"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  timezone: string;
  currentLevel: string;
  twinName: string;
  twinVibe: string;
}

const defaultTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
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
    timezone: defaultTimezone(),
    currentLevel: "",
    twinName: TWIN_NAME_SUGGESTIONS[0],
    twinVibe: "",
  });

  const set = (field: keyof FormData, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex gap-1 mb-2">
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-indigo-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <CardTitle className="text-lg">
            {step === 1 && "What are you working toward?"}
            {step === 2 && "Your daily schedule"}
            {step === 3 && "Where are you starting from?"}
            {step === 4 && "Meet your twin"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Step {step} of 4</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Goal</label>
                <Input
                  placeholder="e.g. Get strong at DSA for job interviews"
                  value={form.goal}
                  onChange={(e) => set("goal", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Why does this matter to you?</label>
                <Textarea
                  placeholder="Be honest — this goes into your plan..."
                  rows={3}
                  value={form.whyItMatters}
                  onChange={(e) => set("whyItMatters", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Timeline</label>
                <div className="flex gap-2">
                  {TIMELINE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("timelineDays", t)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.timelineDays === t
                          ? "bg-indigo-500 text-white border-indigo-500"
                          : "border-gray-200 hover:border-indigo-300"
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
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Daily hours available: <span className="text-indigo-600 font-bold">{form.dailyHours}h</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={form.dailyHours}
                  onChange={(e) => set("dailyHours", parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1h</span><span>8h</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Wake time</label>
                  <Input
                    type="time"
                    value={form.wakeTime}
                    onChange={(e) => set("wakeTime", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Sleep time</label>
                  <Input
                    type="time"
                    value={form.sleepTime}
                    onChange={(e) => set("sleepTime", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Timezone</label>
                <Input
                  value={form.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                  placeholder="e.g. Asia/Singapore"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Tell me where you&apos;re starting from</label>
              <Textarea
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
                <label className="text-sm font-medium">Twin name</label>
                <div className="flex gap-2">
                  {TWIN_NAME_SUGGESTIONS.map((name) => (
                    <button
                      key={name}
                      onClick={() => set("twinName", name)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        form.twinName === name
                          ? "bg-indigo-500 text-white border-indigo-500"
                          : "border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Or type your own name..."
                  value={TWIN_NAME_SUGGESTIONS.includes(form.twinName as typeof TWIN_NAME_SUGGESTIONS[number]) ? "" : form.twinName}
                  onChange={(e) => set("twinName", e.target.value || form.twinName)}
                  onFocus={() => {
                    if (TWIN_NAME_SUGGESTIONS.includes(form.twinName as typeof TWIN_NAME_SUGGESTIONS[number])) {
                      set("twinName", "");
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Their vibe (one line)</label>
                <Input
                  placeholder="e.g. chill but disciplined, lowercase texter"
                  value={form.twinVibe}
                  onChange={(e) => set("twinVibe", e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {form.twinName || "Your twin"} will text you throughout the day about what they&apos;re working on — in character.
              </p>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < 4 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={!canAdvance()}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canAdvance() || loading}>
                {loading ? "Generating your plan…" : "Let's go"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
