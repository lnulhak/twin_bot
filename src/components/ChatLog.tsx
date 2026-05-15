"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Messages with {twinName}
      </h3>

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet — your first nudge fires at your first scheduled block.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "twin_to_user" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  msg.direction === "twin_to_user"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-indigo-500 text-white"
                }`}
              >
                <p>{msg.body}</p>
                <p className={`text-xs mt-0.5 ${msg.direction === "twin_to_user" ? "text-gray-400" : "text-indigo-200"}`}>
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Input
          placeholder={`Reply to ${twinName}...`}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReply()}
          disabled={sending}
        />
        <Button onClick={handleReply} disabled={sending || !reply.trim()} size="sm">
          Send
        </Button>
      </div>
    </div>
  );
}
