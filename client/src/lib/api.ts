const RAW = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
export const API_BASE = RAW.replace(/\/$/, "") + "/api";

export type ErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "unauthorised"
  | "not_found"
  | "conflict"
  | "locked"
  | "internal_error";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;
  constructor(status: number, code: ErrorCode, details?: unknown) {
    super(details ? `${code}: ${JSON.stringify(details)}` : code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getToken(): string | null {
  try {
    return sessionStorage.getItem("fa_access_token");
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem("fa_access_token", token);
    else sessionStorage.removeItem("fa_access_token");
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  return getToken();
}

type ApiFetchOpts = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch<T>(path: string, opts: ApiFetchOpts = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> | undefined),
  };
  const hasBody = opts.body !== undefined;
  if (hasBody && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (res.ok) return data as T;

  // error envelope {error, details}
  if (data && typeof data === "object" && "error" in data) {
    throw new ApiError(res.status, (data as { error: ErrorCode }).error, (data as { details?: unknown }).details);
  }
  throw new ApiError(res.status, res.status === 401 ? "unauthenticated" : res.status === 403 ? "unauthorised" : res.status === 404 ? "not_found" : res.status === 409 ? "conflict" : res.status === 423 ? "locked" : "internal_error", data);
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length > 0) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
