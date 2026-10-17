// Thin client for the ContentSense FastAPI backend.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Params = Record<string, string | number | undefined | null | false>;

export function buildQuery(params?: Params): string {
  if (!params) return "";
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    let code = "error";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg: string }) => d.msg).join("; ");
      code = body.code || code;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(detail, res.status, code);
  }
  return res.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(
      `Can't reach the ContentSense API at ${API_URL}. Make sure the backend is running (see README → How to run).`,
      0,
      "backend_unavailable",
    );
  }
  return handle<T>(res);
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>(`${path}${buildQuery(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<T>(path, { method: "POST", body: fd });
  },
  downloadUrl: (path: string, params?: Params) => `${API_URL}${path}${buildQuery(params)}`,
};
