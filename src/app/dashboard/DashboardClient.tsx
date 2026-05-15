"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import DualTimeline from "@/components/DualTimeline";
import ChatLog from "@/components/ChatLog";
import StreakBadge from "@/components/StreakBadge";
import { Button } from "@/components/ui/button";

interface TodayData {
  user: { id: number; goal: string; timelineDays: number; timezone: string };
  twin: { name: string; personality: string } | null;
  dayNumber: number;
  streak: number;
  startDate: string;
  todayBlocks: Array<{
    id: number;
    startTime: string;
    durationMin: number;
    type: string;
    description: string;
    completed: boolean;
  }>;
  todayTwinBlocks: Array<{
    id: number;
    startTime: string;
    durationMin: number;
    type: string;
    description: string;
    vibe: string;
  }>;
  messages: Array<{
    id: number;
    direction: string;
    body: string;
    createdAt: string;
  }>;
}

export default function DashboardClient() {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState("");
  const [showReset, setShowReset] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/plan/today");
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
    } catch {
      setError("Could not load dashboard.");
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 30s for new messages
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBlockComplete = (id: number) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        todayBlocks: prev.todayBlocks.map((b) =>
          b.id === id ? { ...b, completed: true } : b
        ),
        streak: prev.todayBlocks.find((b) => b.id === id && !b.completed)
          ? prev.streak + 1
          : prev.streak,
      };
    });
  };

  const handleReset = async () => {
    await fetch("/api/dev/reset", { method: "POST" });
    window.location.href = "/onboarding";
  };

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
        Loading your plan…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Echo Twin</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Day {data.dayNumber} of {data.user.timelineDays} •{" "}
              {format(new Date(), "EEEE, MMM d")}
            </p>
            <p className="text-sm text-zinc-500 truncate max-w-sm">
              {data.user.goal}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StreakBadge streak={data.streak} />
            <button
              onClick={() => setShowReset((v) => !v)}
              className="text-zinc-600 hover:text-white p-1 rounded transition-colors"
              title="Dev options"
            >
              ⚙
            </button>
          </div>
        </div>

        {showReset && (
          <div className="mb-4 p-3 bg-zinc-900 border border-red-900 rounded-lg flex items-center gap-3">
            <span className="text-sm text-red-400">Reset everything and restart onboarding.</span>
            <Button variant="destructive" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </div>
        )}

        {/* Dual timeline */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 mb-4">
          <DualTimeline
            userBlocks={data.todayBlocks}
            twinBlocks={data.todayTwinBlocks}
            twinName={data.twin?.name ?? "Twin"}
            onBlockComplete={handleBlockComplete}
          />
        </div>

        {/* Chat log */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
          <ChatLog
            messages={data.messages}
            twinName={data.twin?.name ?? "Twin"}
            onMessageSent={fetchData}
          />
        </div>
      </div>
    </div>
  );
}
