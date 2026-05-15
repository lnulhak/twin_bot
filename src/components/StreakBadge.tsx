"use client";

interface StreakBadgeProps {
  streak: number;
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5">
      <span className="text-lg">🔥</span>
      <span className="text-sm font-semibold text-amber-700">
        {streak} day{streak !== 1 ? "s" : ""} streak
      </span>
    </div>
  );
}
