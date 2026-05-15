"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: number;
  direction: string;
  body: string;
  createdAt: string;
}

interface ChatLogProps {
  messages: Message[];
  twinName: string;
  onMessageSent: () => void;
}

export default function ChatLog({ messages, twinName, onMessageSent }: ChatLogProps) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch("/api/twin/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      setReply("");
      onMessageSent();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Messages with {twinName}
      </h3>

      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">
            No messages yet — your first nudge fires at your first scheduled block.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === "twin_to_user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                msg.direction === "twin_to_user"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                  : "bg-white text-zinc-950"
              }`}>
                <p>{msg.body}</p>
                <p className={`text-xs mt-0.5 ${msg.direction === "twin_to_user" ? "text-zinc-600" : "text-zinc-400"}`}>
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <input
          className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-zinc-500 transition-colors"
          placeholder={`Reply to ${twinName}…`}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReply()}
          disabled={sending}
        />
        <button
          onClick={handleReply}
          disabled={sending || !reply.trim()}
          className="text-sm px-3 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 transition-colors font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
}
