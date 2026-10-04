"use client";
import { useCallback, useEffect, useState } from "react";
import ChatWindow, { Message } from "@/components/ui/ChatWindow";
import Header from "@/components/ui/Header";
import LoginModal from "@/components/ui/LoginModal";
import MessageInput from "@/components/ui/MessageInput";
import Sidebar, { UploadedDoc } from "@/components/ui/Sidebar";
import {
  ApiError,
  ChatSummary,
  ServerDoc,
  Source,
  deleteConversation,
  deleteDocument,
  getConversation,
  listConversations,
  listDocuments,
  streamChat,
  uploadDocument,
} from "@/lib/api";
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
  const [showPanel, setShowPanel] = useState(false); // phones only: swap chat for the chats/documents panel
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(false);

  // Close the login window as soon as a session exists
  useEffect(() => {
    if (token) setShowLogin(false);
  }, [token]);

  // Load the user's saved chats and documents when they sign in; clear them on sign out
  const refreshChats = useCallback(async () => {
    if (!token) {
      setChats([]);
      setActiveChatId(null);
      return;
    }
    try {
      setChats(await listConversations(token));
    } catch {
      /* database offline: the list stays as it is */
    }
  }, [token]);

  const refreshDocs = useCallback(async () => {
    if (!token) {
      setDocs([]);
      return;
    }
    try {
      setDocs((await listDocuments(token)).map(fromServer));
    } catch {
      /* database offline: the list stays empty */
    }
  }, [token]);

  useEffect(() => {
    refreshChats();
    refreshDocs();
  }, [refreshChats, refreshDocs]);

  // ----- chat -----
  const handleSend = async (text: string) => {
    // Guests send recent messages from the browser; signed-in users' memory is kept by the server
    const history = messages
      .filter((m) => !m.isError)
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { id: uid(), role: "user", content: text }]);
    setLoading(true);

    const replyId = uid();
    let reply = "";
    let sources: Source[] = [];
    try {
      await streamChat(text, token, history, activeChatId, {
        onMeta: (meta) => {
          sources = meta.sources;
          if (token) {
            setActiveChatId(meta.conversation_id);
            if (meta.conversation_id !== null) {
              const id = meta.conversation_id;
              const summary = { id, title: meta.title ?? "New chat", updated_at: new Date().toISOString() };
              setChats((c) => [summary, ...c.filter((x) => x.id !== id)]); // move this chat to the top
            }
          }
        },
        onToken: (piece) => {
          reply += piece;
          const content = reply;
          setMessages((m) =>
            m.some((x) => x.id === replyId)
              ? m.map((x) => (x.id === replyId ? { ...x, content } : x))
              : [...m, { id: replyId, role: "assistant", content, sources }],
          );
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof ApiError && err.status === 429) setShowLogin(true); // guest limit hit
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: msg, isError: true }]);
    } finally {
      setLoading(false);
      refreshChats(); // sync titles and order with the server
    }
  };

  const handleNewChat = () => {
    if (loading) return;
    setMessages([]);
    setActiveChatId(null);
    setShowPanel(false);
  };

  const handleSelectChat = async (id: number) => {
    if (loading || id === activeChatId) return;
    try {
      const chat = await getConversation(id, token);
      setMessages(chat.messages.map((m) => ({ id: `saved-${m.id}`, role: m.role, content: m.content, sources: m.sources })));
      setActiveChatId(id);
      setShowPanel(false);
    } catch {
      refreshChats(); // it may have been deleted elsewhere
    }
  };

  const handleDeleteChat = async (id: number) => {
    if (loading || !window.confirm("Delete this chat?")) return;
    try {
      await deleteConversation(id, token);
      setChats((c) => c.filter((x) => x.id !== id));
      if (id === activeChatId) handleNewChat();
    } catch {
      refreshChats();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setMessages([]); // do not leave one person's chat on screen for the next
  };

  // ----- documents -----
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
      <Header email={email} ready={ready} onSignIn={() => setShowLogin(true)} onSignOut={handleSignOut} />

      {/* Phones only: toggle between the chat and the chats/documents panel */}
      <button onClick={() => setShowPanel((v) => !v)} className="glass rounded-xl px-4 py-2 text-sm md:hidden">
        {showPanel ? "Back to chat" : "Chats & documents"}
      </button>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className={`${showPanel ? "flex" : "hidden"} min-h-0 w-full md:flex md:w-auto`}>
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            busy={loading}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            docs={docs}
            onUpload={handleUpload}
            onDelete={handleDelete}
            locked={!token}
            onSignIn={() => setShowLogin(true)}
          />
        </div>
        <section className={`glass min-w-0 flex-1 flex-col rounded-3xl ${showPanel ? "hidden md:flex" : "flex"}`}>
          <ChatWindow messages={messages} loading={loading} />
          <MessageInput onSend={handleSend} disabled={loading} />
        </section>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </main>
  );
}
