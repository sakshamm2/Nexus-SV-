const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const authHeader = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export async function sendChat(message: string, token: string | null): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ message }),
  });
  return (await handle<{ reply: string }>(res)).reply;
}

export async function uploadDocument(file: File, token: string | null) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/v1/documents`, {
    method: "POST",
    headers: authHeader(token),
    body: form,
  });
  return handle<{ filename: string; size_bytes: number }>(res);
}