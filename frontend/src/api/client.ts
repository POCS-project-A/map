// 모든 서버 호출이 지나가는 한 곳.
// - 배포 빌드: 항상 진짜 백엔드(/api)로 보낸다. 가짜 서버 코드는 빌드에 들어가지 않는다.
// - 개발 모드: 기본은 브라우저 안의 가짜 서버(mock). 백엔드에 이미 있는 API(장소 검색)는 진짜를 먼저 부르고,
//   백엔드가 없거나 실패하면 가짜로 넘어간다. 가짜를 완전히 끄려면 .env에 VITE_USE_MOCK=false

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== "false";

// 백엔드에 이미 구현된 API. 개발 모드에서도 진짜를 먼저 시도한다.
const REAL_FIRST = [/^\/places\/search/];

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
  // 비로그인으로 만든 여행은 여행별 edit_token으로 수정한다 (API 명세의 인증 규칙)
  const m = path.match(/^\/trips\/(\d+)/);
  if (m) {
    const edit = localStorage.getItem(`edit_token:${m[1]}`);
    if (edit) headers["X-Edit-Token"] = edit;
  }
  return headers;
}

// 개발 모드의 "API 기록" 창에 보여 주려고 요청마다 이벤트를 남긴다
export interface ApiLogEntry { id: number; method: string; path: string; status: number; ms: number; body?: unknown; response?: unknown; mock?: boolean }
let logId = 0;
function log(entry: Omit<ApiLogEntry, "id">) {
  if (!import.meta.env.DEV) return;
  window.dispatchEvent(new CustomEvent<ApiLogEntry>("api-log", { detail: { id: ++logId, ...entry } }));
}

async function realFetch(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(path) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body: data };
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const started = performance.now();
  let res: { status: number; body: unknown } | null = null;
  let mock = false;

  if (USE_MOCK) {
    if (REAL_FIRST.some((re) => re.test(path))) {
      // 백엔드가 떠 있고 키가 있으면 진짜 응답. 아니면(연결 실패, 5xx) 가짜로 넘어간다.
      res = await realFetch(method, path, body).catch(() => null);
      if (res && res.status >= 500) res = null;
    }
    if (!res) {
      const { handleMock } = await import("./mock/server"); // 개발 모드에서만 불러온다
      res = await handleMock(method, path, body);
      mock = true;
    }
  } else {
    res = await realFetch(method, path, body);
  }

  log({ method, path: `/api${path}`, status: res.status, ms: Math.round(performance.now() - started), body, response: res.body, mock });
  if (res.status >= 400) throw new ApiError(res.status, String((res.body as { detail?: string } | null)?.detail ?? `요청 실패 (${res.status})`));
  return res.body as T;
}

export const isMock = USE_MOCK;
