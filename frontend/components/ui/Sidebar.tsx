"use client";
import { useRef, useState } from "react";
import { FileText, Lock, MessageSquare, Plus, Trash2, UploadCloud, X } from "lucide-react";
import type { ChatSummary } from "@/lib/api";

export type UploadedDoc = {
  key: string;
  id?: number; // set once the server has saved it
  name: string;
  status: "uploading" | "done" | "error";
  detail?: string; // error message or "12 sections"
};

type Props = {
  chats: ChatSummary[];
  activeChatId: number | null;
  busy: boolean; // a reply is being written: chat switching is paused
  onNewChat: () => void;
  onSelectChat: (id: number) => void;
  onDeleteChat: (id: number) => void;
  docs: UploadedDoc[];
  onUpload: (files: FileList) => void;
  onDelete: (doc: UploadedDoc) => void;
  locked: boolean; // guests
  onSignIn: () => void;
};

const gradientBtn =
  "rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 font-medium text-white transition hover:brightness-110 disabled:opacity-50";

function Locked({ text, onSignIn }: { text: string; onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-gray-300">
      <Lock className="h-6 w-6 text-gray-400" />
      <p>{text}</p>
      <button onClick={onSignIn} className={`${gradientBtn} px-4 py-2`}>
        Sign in
      </button>
    </div>
  );
}

export default function Sidebar(p: Props) {
  const [tab, setTab] = useState<"chats" | "docs">("chats");
  const inputRef = useRef<HTMLInputElement>(null);

  const tabBtn = (id: "chats" | "docs", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 rounded-lg py-1.5 text-sm transition ${
        tab === id ? "bg-white/10 font-medium text-white" : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside className="glass flex w-full shrink-0 flex-col rounded-3xl bg-[#0b0b0d]/95 p-4 md:w-72 md:bg-white/[0.05]">
      <div className="mb-4 flex gap-1 rounded-xl bg-black/30 p-1">
        {tabBtn("chats", "Chats")}
        {tabBtn("docs", "Documents")}
      </div>

      {tab === "chats" ? (
        p.locked ? (
          <Locked text="Sign in to save your chats and come back to them later." onSignIn={p.onSignIn} />
        ) : (
          <>
            <button onClick={p.onNewChat} disabled={p.busy} className={`${gradientBtn} flex items-center justify-center gap-2 py-2.5 text-sm`}>
              <Plus className="h-4 w-4" /> New chat
            </button>
            <ul className="mt-4 flex-1 space-y-1 overflow-y-auto">
              {p.chats.length === 0 && <li className="text-sm text-gray-500">No saved chats yet. Send a message to start one.</li>}
              {p.chats.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-xl border px-3 py-2 text-sm ${
                    c.id === p.activeChatId ? "border-fuchsia-400/40 bg-fuchsia-500/10" : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={() => p.onSelectChat(c.id)}
                    disabled={p.busy}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    onClick={() => p.onDeleteChat(c.id)}
                    disabled={p.busy}
                    aria-label={`Delete chat ${c.title}`}
                    title="Delete chat"
                    className="shrink-0 text-gray-500 opacity-60 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : p.locked ? (
        <Locked text="Sign in to upload documents and ask questions about them." onSignIn={p.onSignIn} />
      ) : (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/20 p-6 text-sm text-gray-300 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <UploadCloud className="h-6 w-6 text-gray-300" />
            Upload files
            <span className="text-xs text-gray-500">PDF, DOCX, TXT, MD · up to 10 MB</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => {
              if (e.target.files) p.onUpload(e.target.files);
              e.target.value = ""; // lets the same file be chosen again
            }}
          />
          <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {p.docs.length === 0 && <li className="text-sm text-gray-500">No documents yet.</li>}
            {p.docs.map((d) => (
              <li key={d.key} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{d.name}</span>
                  {d.status === "done" && d.id !== undefined ? (
                    <button
                      onClick={() => p.onDelete(d)}
                      aria-label={`Delete ${d.name}`}
                      title="Delete"
                      className="ml-auto text-gray-500 transition hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className={`ml-auto shrink-0 text-xs ${d.status === "error" ? "text-red-400" : "text-gray-400"}`}>
                      {d.status === "uploading" ? "Processing…" : "Failed"}
                    </span>
                  )}
                </div>
                {d.detail && (
                  <p className={`mt-1 pl-7 text-xs ${d.status === "error" ? "text-red-400" : "text-gray-500"}`}>{d.detail}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
