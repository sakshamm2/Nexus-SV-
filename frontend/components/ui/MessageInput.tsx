"use client";
import { useState } from "react";
import { SendHorizonal } from "lucide-react";

export default function MessageInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="glass m-4 flex items-end gap-2 rounded-2xl p-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // Enter sends, Shift+Enter adds a new line
            submit();
          }
        }}
        rows={1}
        placeholder="Message Nexus SV"
        className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-500"
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="btn-red p-2.5"
      >
        <SendHorizonal className="h-4 w-4" />
      </button>
    </div>
  );
}