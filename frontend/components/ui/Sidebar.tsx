"use client";
import { useRef } from "react";
import { FileText, Lock, Trash2, UploadCloud } from "lucide-react";

export type UploadedDoc = {
  key: string;
  id?: number; // set once the server has saved it
  name: string;
  status: "uploading" | "done" | "error";
  detail?: string; // error message or "12 chunks"
};

type Props = {
  docs: UploadedDoc[];
  onUpload: (files: FileList) => void;
  onDelete: (doc: UploadedDoc) => void;
  locked: boolean;
  onSignIn: () => void;
};

export default function Sidebar({ docs, onUpload, onDelete, locked, onSignIn }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="glass flex w-full shrink-0 flex-col rounded-3xl bg-[#0b0b0d]/95 p-4 md:w-72 md:bg-white/[0.05]">
      <h2 className="mb-3 text-lg font-semibold">Documents</h2>

      {locked ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-gray-300">
          <Lock className="h-6 w-6 text-gray-400" />
          <p>Sign in to upload documents and ask questions about them.</p>
          <button
            onClick={onSignIn}
            className="rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 px-4 py-2 font-medium text-white transition hover:brightness-110"
          >
            Sign in
          </button>
        </div>
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
              if (e.target.files) onUpload(e.target.files);
              e.target.value = ""; // lets the same file be chosen again
            }}
          />
          <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {docs.length === 0 && <li className="text-sm text-gray-500">No documents yet.</li>}
            {docs.map((d) => (
              <li key={d.key} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{d.name}</span>
                  {d.status === "done" && d.id !== undefined ? (
                    <button
                      onClick={() => onDelete(d)}
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
                  <p className={`mt-1 pl-7 text-xs ${d.status === "error" ? "text-red-400" : "text-gray-500"}`}>
                    {d.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
