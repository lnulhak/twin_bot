"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const TYPE_COLORS: Record<string, string> = {
  deep_work: "bg-indigo-100 text-indigo-700",
  review: "bg-blue-100 text-blue-700",
  rest: "bg-green-100 text-green-700",
  skill_practice: "bg-purple-100 text-purple-700",
};

const TYPE_ICONS: Record<string, string> = {
  deep_work: "⚡",
  review: "📖",
  rest: "☕",
  skill_practice: "🔧",
};

function getCurrentTwinBlock(blocks: TwinBlock[]): TwinBlock | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return (
    blocks.find((b) => {
      const [h, m] = b.startTime.split(":").map(Number);
      const start = h * 60 + m;
      return currentMinutes >= start && currentMinutes < start + b.durationMin;
    }) ?? null
  );
}

function BlockCard({
  block,
  onComplete,
}: {
  block: Block;
  onComplete: (id: number) => void;
}) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    await fetch(`/api/blocks/${block.id}/complete`, { method: "POST" });
    onComplete(block.id);
    setCompleting(false);
  };

  return (
    <div
      className={`flex gap-3 p-3 rounded-xl border transition-opacity ${
        block.completed ? "opacity-50 bg-gray-50" : "bg-white"
      }`}
    >
      <div className="text-center min-w-[48px]">
        <p className="text-xs font-mono text-muted-foreground">{block.startTime}</p>
        <p className="text-xs text-muted-foreground">{block.durationMin}m</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{TYPE_ICONS[block.type] ?? "📌"}</span>
          <Badge
            className={`text-xs px-1.5 py-0 ${TYPE_COLORS[block.type] ?? "bg-gray-100 text-gray-700"}`}
          >
            {block.type.replace("_", " ")}
          </Badge>
        </div>
        <p
          className={`text-sm leading-snug ${
            block.completed ? "line-through text-muted-foreground" : ""
          }`}
        >
          {block.description}
        </p>
      </div>
      {!block.completed && (
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 shrink-0"
          onClick={handleComplete}
          disabled={completing}
        >
          Done
        </Button>
      )}
    </div>
  );
}

function TwinBlockCard({ block }: { block: TwinBlock; isCurrent?: boolean }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl border bg-white">
      <div className="text-center min-w-[48px]">
        <p className="text-xs font-mono text-muted-foreground">{block.startTime}</p>
        <p className="text-xs text-muted-foreground">{block.durationMin}m</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{TYPE_ICONS[block.type] ?? "📌"}</span>
          <Badge
            className={`text-xs px-1.5 py-0 ${TYPE_COLORS[block.type] ?? "bg-gray-100 text-gray-700"}`}
          >
            {block.type.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-sm leading-snug">{block.description}</p>
        <p className="text-xs text-muted-foreground italic mt-1">{block.vibe}</p>
      </div>
    </div>
  );
}

export default function DualTimeline({
  userBlocks,
  twinBlocks,
  twinName,
  onBlockComplete,
}: DualTimelineProps) {
  const currentTwinBlock = getCurrentTwinBlock(twinBlocks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* User column */}
      <div>
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          You
        </h2>
        {userBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocks scheduled for today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {userBlocks.map((b) => (
              <BlockCard key={b.id} block={b} onComplete={onBlockComplete} />
            ))}
          </div>
        )}
      </div>

      {/* Twin column */}
      <div>
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
          {twinName}
          {currentTwinBlock && (
            <span className="text-xs font-normal bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">
              Now: {currentTwinBlock.description.slice(0, 30)}…
            </span>
          )}
        </h2>
        {twinBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No twin blocks for today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {twinBlocks.map((b) => (
              <TwinBlockCard
                key={b.id}
                block={b}
                isCurrent={b.id === currentTwinBlock?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
