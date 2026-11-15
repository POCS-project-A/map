// 모든 서버 호출이 지나가는 한 곳. 가짜 서버 모드면 mock이, 아니면 진짜 fetch가 응답한다.
import { handleMock } from "./mock/server";

// 기본은 가짜 서버. 백엔드가 준비되면 .env에 VITE_USE_MOCK=false
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders(path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("access_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  // 비로그인으로 만든 여행은 여행별 edit_token으로 수정한다 (docs/api.md 인증 규칙)
  const m = path.match(/^\/trips\/(\d+)/);
  if (m) {
    const edit = localStorage.getItem(`edit_token:${m[1]}`);
    if (edit) headers["X-Edit-Token"] = edit;
  }
  return headers;
}

// 화면 아래 "API 기록" 창에 보여 주려고 요청마다 이벤트를 남긴다
export interface ApiLogEntry { id: number; method: string; path: string; status: number; ms: number; body?: unknown; response?: unknown }
let logId = 0;
function log(entry: Omit<ApiLogEntry, "id">) {
  window.dispatchEvent(new CustomEvent<ApiLogEntry>("api-log", { detail: { id: ++logId, ...entry } }));
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const started = performance.now();
  if (USE_MOCK) {
    const res = await handleMock(method, path, body);
    log({ method, path: `/api${path}`, status: res.status, ms: Math.round(performance.now() - started), body, response: res.body });
    if (res.status >= 400) throw new ApiError(res.status, String((res.body as { detail?: string })?.detail ?? "요청 실패"));
    return res.body as T;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(path) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  log({ method, path: `/api${path}`, status: res.status, ms: Math.round(performance.now() - started), body, response: data });
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? `요청 실패 (${res.status})`);
  return data as T;
}

export const isMock = USE_MOCK;
