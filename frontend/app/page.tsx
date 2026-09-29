"use client";
import { useEffect, useState } from "react";
import ChatWindow, { Message } from "@/components/ui/ChatWindow";
import Header from "@/components/ui/Header";
import LoginModal from "@/components/ui/LoginModal";
import MessageInput from "@/components/ui/MessageInput";
import Sidebar, { UploadedDoc } from "@/components/ui/Sidebar";
import { ApiError, sendChat, uploadDocument } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const uid = () => Math.random().toString(36).slice(2);

export default function ChatPage() {
  const { email, token, ready, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(false);

  // Close the login window as soon as a session exists (e.g. after clicking the email link)
  useEffect(() => {
    if (token) setShowLogin(false);
  }, [token]);

  const handleSend = async (text: string) => {
    setMessages((m) => [...m, { id: uid(), role: "user", content: text }]);
    setLoading(true);
    try {
      const reply = await sendChat(text, token);
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof ApiError && err.status === 429) setShowLogin(true); // guest limit hit
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!token) return setShowLogin(true);
    for (const file of Array.from(files)) {
      setDocs((d) => [...d, { name: file.name, status: "uploading" }]);
      let status: UploadedDoc["status"] = "done";
      try {
        await uploadDocument(file, token);
      } catch {
        status = "error";
      }
      setDocs((d) => d.map((x) => (x.name === file.name ? { ...x, status } : x)));
    }
  };

  return (
    <main className="flex h-screen flex-col gap-4 p-4">
      <Header email={email} ready={ready} onSignIn={() => setShowLogin(true)} onSignOut={signOut} />
      <div className="flex min-h-0 flex-1 gap-4">
        <Sidebar docs={docs} onUpload={handleUpload} locked={!token} onSignIn={() => setShowLogin(true)} />
        <section className="glass flex min-w-0 flex-1 flex-col rounded-3xl">
          <ChatWindow messages={messages} loading={loading} />
          <MessageInput onSend={handleSend} disabled={loading} />
        </section>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </main>
  );
}