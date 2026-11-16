// 모든 서버 호출이 지나가는 한 곳.
// - 배포 빌드: 항상 진짜 백엔드(/api)로 보낸다. 가짜 서버 코드는 빌드에 들어가지 않는다.
// - 개발 모드: 기본은 브라우저 안의 가짜 서버(mock). 백엔드에 이미 있는 API(장소 검색)는 진짜를 먼저 부르고,
//   백엔드가 없거나 실패하면 가짜로 넘어간다. 가짜를 완전히 끄려면 .env에 VITE_USE_MOCK=false

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== "false";

// 백엔드에 이미 구현된 API. 개발 모드에서도 진짜를 먼저 시도한다.
const REAL_FIRST = [/^\/places\/search/];

// 실패 이유를 화면에 보여 주기 위한 오류. 어떤 요청이 왜 실패했는지 담는다.
export class ApiError extends Error {
  status: number; // 0이면 서버에 연결하지 못함
  request: string; // 예: "GET /api/trips"
  constructor(status: number, request: string, detail?: string) {
    super(reasonOf(status, detail));
    this.status = status;
    this.request = request;
  }
}

function reasonOf(status: number, detail?: string) {
  if (detail) return detail;
  if (status === 0) return "서버에 연결하지 못했어요.";
  if (status === 404) return "서버에 아직 이 기능이 없거나, 찾는 항목이 없어요.";
  if (status === 409) return "다른 작업과 겹쳐서 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  if (status === 429) return "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.";
  if (status >= 500) return "서버에서 오류가 났어요.";
  return "요청을 처리하지 못했어요.";
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

const NOT_JSON = Symbol("not-json");
type Res = { status: number; body: unknown };

async function realFetch(method: string, path: string, body?: unknown): Promise<Res> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(path) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return { status: 204, body: null };
  // JSON이 아닌 응답(예: nginx 오류 페이지)은 따로 표시해서 원인을 잃지 않는다
  const data: unknown = await res.json().catch(() => NOT_JSON);
  return { status: res.status, body: data };
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const started = performance.now();
  const label = `${method} /api${path}`;
  let res: Res | null = null;
  let mock = false;

  try {
    if (USE_MOCK) {
      if (REAL_FIRST.some((re) => re.test(path))) {
        // 백엔드가 떠 있고 키가 있으면 진짜 응답. 아니면(연결 실패, 5xx, JSON 아님) 가짜로 넘어간다.
        res = await realFetch(method, path, body).catch(() => null);
        if (res && (res.status >= 500 || res.body === NOT_JSON)) res = null;
      }
      if (!res) {
        const { handleMock } = await import("./mock/server"); // 개발 모드에서만 불러온다
        res = await handleMock(method, path, body);
        mock = true;
      }
    } else {
      res = await realFetch(method, path, body);
    }
  } catch {
    log({ method, path: `/api${path}`, status: 0, ms: Math.round(performance.now() - started), body });
    throw new ApiError(0, label);
  }

  log({ method, path: `/api${path}`, status: res.status, ms: Math.round(performance.now() - started), body, response: res.body === NOT_JSON ? "(JSON이 아닌 응답)" : res.body, mock });
  if (res.body === NOT_JSON) {
    throw new ApiError(res.status, label, res.status < 400 ? "서버 응답 형식이 올바르지 않아요 (JSON이 아님)." : undefined);
  }
  if (res.status >= 400) {
    const detail = (res.body as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, label, typeof detail === "string" ? detail : undefined);
  }
  return res.body as T;
}

export const isMock = USE_MOCK;
