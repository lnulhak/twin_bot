"use client";

interface StreakBadgeProps {
  streak: number;
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 border border-zinc-700 rounded-full px-3 py-1">
      <span className="text-sm">🔥</span>
      <span className="text-sm text-zinc-300">
        {streak} day{streak !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
