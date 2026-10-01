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

const authHeader = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`;
    throw new ApiError(detail, res.status);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export type HistoryItem = { role: "user" | "assistant"; content: string };

export async function sendChat(
  message: string,
  token: string | null,
  history: HistoryItem[] = [],
): Promise<{ reply: string; sources: Source[] }> {
  const res = await fetch(`${BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ message, history }),
  });
  return handle(res);
}

export async function listDocuments(token: string | null): Promise<ServerDoc[]> {
  const res = await fetch(`${BASE}/api/v1/documents`, { headers: authHeader(token) });
  return handle(res);
}

export async function uploadDocument(file: File, token: string | null): Promise<ServerDoc> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/v1/documents`, { method: "POST", headers: authHeader(token), body: form });
  return handle(res);
}

export async function deleteDocument(id: number, token: string | null): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/documents/${id}`, { method: "DELETE", headers: authHeader(token) });
  return handle(res);
}
