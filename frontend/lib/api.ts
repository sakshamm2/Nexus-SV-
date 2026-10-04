const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Source = { document_id: number; filename: string; page: number | null };
export type ServerDoc = { id: number; filename: string; size_bytes: number; chunk_count: number; created_at: string };
export type HistoryItem = { role: "user" | "assistant"; content: string };
export type ChatSummary = { id: number; title: string; updated_at: string };
export type SavedMessage = { id: number; role: "user" | "assistant"; content: string; sources: Source[] };
export type ChatDetail = { id: number; title: string; messages: SavedMessage[] };

const authHeader = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

async function failure(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const detail = typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`;
  return new ApiError(detail, res.status);
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await failure(res);
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

// ---------- chat (streaming) ----------
export type StreamHandlers = {
  onMeta: (meta: { conversation_id: number | null; title: string | null; sources: Source[] }) => void;
  onToken: (text: string) => void;
};

/** Sends a message and calls onToken as the reply is written. Throws ApiError on any failure. */
export async function streamChat(
  message: string,
  token: string | null,
  history: HistoryItem[],
  conversationId: number | null,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ message, history, conversation_id: conversationId }),
  });
  if (!res.ok) throw await failure(res);
  if (!res.body) throw new ApiError("Streaming is not supported by this browser.", 500);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  // The server sends events separated by a blank line: "event: name" then "data: {json}"
  const dispatch = (block: string) => {
    let event = "";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!event || !data) return;
    const payload = JSON.parse(data);
    if (event === "meta") handlers.onMeta(payload);
    else if (event === "token") handlers.onToken(payload.text);
    else if (event === "done") finished = true;
    else if (event === "error") throw new ApiError(payload.detail ?? "Something went wrong.", 502);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      dispatch(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
    }
  }
  if (!finished) throw new ApiError("The connection was interrupted before the reply finished.", 502);
}

// ---------- saved chats ----------
export async function listConversations(token: string | null): Promise<ChatSummary[]> {
  return handle(await fetch(`${BASE}/api/v1/conversations`, { headers: authHeader(token) }));
}

export async function getConversation(id: number, token: string | null): Promise<ChatDetail> {
  return handle(await fetch(`${BASE}/api/v1/conversations/${id}`, { headers: authHeader(token) }));
}

export async function deleteConversation(id: number, token: string | null): Promise<void> {
  return handle(await fetch(`${BASE}/api/v1/conversations/${id}`, { method: "DELETE", headers: authHeader(token) }));
}

// ---------- documents ----------
export async function listDocuments(token: string | null): Promise<ServerDoc[]> {
  return handle(await fetch(`${BASE}/api/v1/documents`, { headers: authHeader(token) }));
}

export async function uploadDocument(file: File, token: string | null): Promise<ServerDoc> {
  const form = new FormData();
  form.append("file", file);
  return handle(await fetch(`${BASE}/api/v1/documents`, { method: "POST", headers: authHeader(token), body: form }));
}

export async function deleteDocument(id: number, token: string | null): Promise<void> {
  return handle(await fetch(`${BASE}/api/v1/documents/${id}`, { method: "DELETE", headers: authHeader(token) }));
}
