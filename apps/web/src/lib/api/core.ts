// Explicit NEXT_PUBLIC_API_URL wins (production). Otherwise, in the browser,
// talk to whatever host served this page — so the same build works from
// localhost:3000 and from a LAN IP (phone testing) without hardcoding an IP
// that changes on every DHCP renewal. Server-side rendering has no window,
// so it always hits the API on this same machine directly.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    // FastAPI's own validation errors (422) shape `detail` as an array of
    // {msg, loc, ...} objects rather than a string — render that as text
    // instead of handing React a non-string child that blows up the page.
    const detail = Array.isArray(body.detail)
      ? body.detail.map((e: { msg?: string }) => e.msg).join(", ")
      : body.detail;
    throw new ApiError(res.status, detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  return handleResponse<T>(res);
}

// No Content-Type header here — the browser sets its own
// multipart/form-data boundary for a FormData body, and forcing
// application/json (like apiFetch does) would break the upload.
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", body: formData });
  return handleResponse<T>(res);
}
