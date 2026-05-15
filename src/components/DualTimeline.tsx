"use client";

import { useState } from "react";

interface Block {
  id: number;
  startTime: string;
  durationMin: number;
  type: string;
  description: string;
  completed: boolean;
}

interface TwinBlock {
  id: number;
  startTime: string;
  durationMin: number;
  type: string;
  description: string;
  vibe: string;
}

interface DualTimelineProps {
  userBlocks: Block[];
  twinBlocks: TwinBlock[];
  twinName: string;
  onBlockComplete: (id: number) => void;
}

const TYPE_ICONS: Record<string, string> = {
  deep_work: "⚡",
  review: "📖",
  rest: "☕",
  skill_practice: "🔧",
};

const TYPE_LABELS: Record<string, string> = {
  deep_work: "deep work",
  review: "review",
  rest: "rest",
  skill_practice: "practice",
};

function getCurrentTwinBlock(blocks: TwinBlock[]): TwinBlock | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return blocks.find((b) => {
    const [h, m] = b.startTime.split(":").map(Number);
    const start = h * 60 + m;
    return currentMinutes >= start && currentMinutes < start + b.durationMin;
  }) ?? null;
}

function BlockCard({ block, onComplete }: { block: Block; onComplete: (id: number) => void }) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    await fetch(`/api/blocks/${block.id}/complete`, { method: "POST" });
    onComplete(block.id);
    setCompleting(false);
  };

  return (
    <div className={`flex gap-3 p-3 rounded-xl border transition-opacity ${
      block.completed ? "opacity-40 border-zinc-800 bg-zinc-900" : "border-zinc-700 bg-zinc-800/50"
    }`}>
      <div className="text-center min-w-[44px] pt-0.5">
        <p className="text-xs font-mono text-zinc-500">{block.startTime}</p>
        <p className="text-xs text-zinc-600">{block.durationMin}m</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs">{TYPE_ICONS[block.type] ?? "📌"}</span>
          <span className="text-xs text-zinc-500">{TYPE_LABELS[block.type] ?? block.type}</span>
        </div>
        <p className={`text-sm text-white leading-snug ${block.completed ? "line-through text-zinc-500" : ""}`}>
          {block.description}
        </p>
      </div>
      {!block.completed && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-2 py-1 shrink-0 transition-colors disabled:opacity-30"
        >
          Done
        </button>
      )}
    </div>
  );
}

function TwinBlockCard({ block, isCurrent }: { block: TwinBlock; isCurrent?: boolean }) {
  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${
      isCurrent ? "border-zinc-500 bg-zinc-800" : "border-zinc-700 bg-zinc-800/50"
    }`}>
      <div className="text-center min-w-[44px] pt-0.5">
        <p className="text-xs font-mono text-zinc-500">{block.startTime}</p>
        <p className="text-xs text-zinc-600">{block.durationMin}m</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs">{TYPE_ICONS[block.type] ?? "📌"}</span>
          <span className="text-xs text-zinc-500">{TYPE_LABELS[block.type] ?? block.type}</span>
        </div>
        <p className="text-sm text-white leading-snug">{block.description}</p>
        <p className="text-xs text-zinc-600 italic mt-1">{block.vibe}</p>
      </div>
    </div>
  );
}

export default function DualTimeline({ userBlocks, twinBlocks, twinName, onBlockComplete }: DualTimelineProps) {
  const currentTwinBlock = getCurrentTwinBlock(twinBlocks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">You</h2>
        {userBlocks.length === 0 ? (
          <p className="text-sm text-zinc-600">No blocks scheduled for today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {userBlocks.map((b) => <BlockCard key={b.id} block={b} onComplete={onBlockComplete} />)}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{twinName}</h2>
          {currentTwinBlock && (
            <span className="text-xs text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5">
              now: {currentTwinBlock.description.slice(0, 28)}…
            </span>
          )}
        </div>
        {twinBlocks.length === 0 ? (
          <p className="text-sm text-zinc-600">No twin blocks for today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {twinBlocks.map((b) => (
              <TwinBlockCard key={b.id} block={b} isCurrent={b.id === currentTwinBlock?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
