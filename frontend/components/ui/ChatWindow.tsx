"use client";
import { useEffect, useRef } from "react";
import { Bot, FileText, User } from "lucide-react";
import type { Source } from "@/lib/api";

export type Message = { id: string; role: "user" | "assistant"; content: string; sources?: Source[]; isError?: boolean };

export default function ChatWindow({ messages, loading }: { messages: Message[]; loading: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Keep the newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="h-32 w-32 rounded-full bg-gradient-to-br from-fuchsia-400 via-pink-500 to-violet-600 opacity-80 blur-2xl" />
        <h2 className="text-2xl font-semibold">Ask anything about your documents</h2>
        <p className="text-sm text-gray-400">Upload files on the left, then start typing below.</p>
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
              <Bot className="h-4 w-4 text-fuchsia-400" />
            )}
          </div>
          <div className="max-w-[75%]">
            <div
              className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user" ? "bubble-user" : "glass"
              }`}
            >
              {m.content}
            </div>
            {/* Which of the user's documents the answer used */}
            {m.sources && m.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.sources.map((s) => (
                  <span
                    key={`${s.document_id}-${s.page}`}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-gray-300"
                  >
                    <FileText className="h-3 w-3" />
                    {s.filename}
                    {s.page ? ` · p.${s.page}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {loading && <div className="text-sm text-fuchsia-300/70">Nexus is thinking…</div>}
      <div ref={endRef} />
    </div>
  );
}
