"use client";
import { useCallback, useEffect, useState } from "react";
import ChatWindow, { Message } from "@/components/ui/ChatWindow";
import Header from "@/components/ui/Header";
import LoginModal from "@/components/ui/LoginModal";
import MessageInput from "@/components/ui/MessageInput";
import Sidebar, { UploadedDoc } from "@/components/ui/Sidebar";
import { ApiError, ServerDoc, deleteDocument, listDocuments, sendChat, uploadDocument } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const uid = () => Math.random().toString(36).slice(2);

const fromServer = (d: ServerDoc): UploadedDoc => ({
  key: `doc-${d.id}`,
  id: d.id,
  name: d.filename,
  status: "done",
  detail: `${d.chunk_count} sections`,
});

export default function ChatPage() {
  const { email, token, ready, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showDocs, setShowDocs] = useState(false); // phones only: swap chat for the documents panel
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(false);

  // Close the login window as soon as a session exists
  useEffect(() => {
    if (token) setShowLogin(false);
  }, [token]);

  // Load this user's saved documents when they sign in; clear the list when they sign out
  const refreshDocs = useCallback(async () => {
    if (!token) {
      setDocs([]);
      return;
    }
    try {
      setDocs((await listDocuments(token)).map(fromServer));
    } catch {
      /* the database may be offline; the list simply stays empty */
    }
  }, [token]);

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  const handleSend = async (text: string) => {
    // The chatbot remembers the last few real messages (error notices are not sent)
    const history = messages
      .filter((m) => !m.isError)
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { id: uid(), role: "user", content: text }]);
    setLoading(true);
    try {
      const { reply, sources } = await sendChat(text, token, history);
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: reply, sources }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof ApiError && err.status === 429) setShowLogin(true); // guest limit hit
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: msg, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!token) return setShowLogin(true);
    for (const file of Array.from(files)) {
      const key = uid();
      setDocs((d) => [{ key, name: file.name, status: "uploading" }, ...d]);
      try {
        const saved = await uploadDocument(file, token);
        setDocs((d) => d.map((x) => (x.key === key ? fromServer(saved) : x)));
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Upload failed";
        setDocs((d) => d.map((x) => (x.key === key ? { ...x, status: "error", detail } : x)));
      }
    }
  };

  const handleDelete = async (doc: UploadedDoc) => {
    if (doc.id === undefined) return;
    try {
      await deleteDocument(doc.id, token);
      setDocs((d) => d.filter((x) => x.key !== doc.key));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Delete failed";
      setDocs((d) => d.map((x) => (x.key === doc.key ? { ...x, detail } : x)));
    }
  };

  return (
    <main className="flex h-dvh flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <Header email={email} ready={ready} onSignIn={() => setShowLogin(true)} onSignOut={signOut} />

      {/* Phones only: toggle between chat and documents */}
      <button onClick={() => setShowDocs((v) => !v)} className="glass rounded-xl px-4 py-2 text-sm md:hidden">
        {showDocs ? "Back to chat" : "Documents"}
      </button>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className={`${showDocs ? "flex" : "hidden"} min-h-0 w-full md:flex md:w-auto`}>
          <Sidebar
            docs={docs}
            onUpload={handleUpload}
            onDelete={handleDelete}
            locked={!token}
            onSignIn={() => setShowLogin(true)}
          />
        </div>
        <section className={`glass min-w-0 flex-1 flex-col rounded-3xl ${showDocs ? "hidden md:flex" : "flex"}`}>
          <ChatWindow messages={messages} loading={loading} />
          <MessageInput onSend={handleSend} disabled={loading} />
        </section>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </main>
  );
}
