"use client";
import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

export type Message = { id: string; role: "user" | "assistant"; content: string };

export default function ChatWindow({ messages, loading }: { messages: Message[]; loading: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Keep the newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500">
        Ask a question to get started.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.map((m) => (
        <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
          <div className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            {m.role === "user" ? (
              <User className="h-4 w-4 text-gray-300" />
            ) : (
              <Bot className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div
            className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user" ? "glass-red" : "glass"
            }`}
          >
            {m.content}
          </div>
        </div>
      ))}
      {loading && <div className="text-sm text-gray-400">Nexus is thinking…</div>}
      <div ref={endRef} />
    </div>
  );
}