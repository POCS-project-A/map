import { useEffect, useState } from "react";
import { isMock, type ApiLogEntry } from "../api/client";

// 화면에서 무슨 REST 요청이 오갔는지 보여 주는 개발용 창 (개발 모드에서만 보인다). API 명세 확인용.
export default function ApiLog() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [picked, setPicked] = useState<ApiLogEntry | null>(null);
  useEffect(() => {
    const on = (e: Event) => setLogs((l) => [(e as CustomEvent<ApiLogEntry>).detail, ...l].slice(0, 100));
    addEventListener("api-log", on);
    return () => removeEventListener("api-log", on);
  }, []);
  const shown = logs.filter((l) => !l.path.startsWith("/api/jobs/") || l.response && (l.response as { status?: string }).status === "done");
  return (
    <div className={`api-log ${open ? "open" : ""}`}>
      <button className="api-log-toggle" onClick={() => setOpen(!open)}>
        API 기록 {logs.length} {isMock ? "· 가짜 서버" : ""} {open ? "▾" : "▴"}
      </button>
      {open && (
        <div className="api-log-body">
          <div className="api-log-list">
            {shown.map((l) => (
              <button key={l.id} className={`api-log-row ${picked?.id === l.id ? "sel" : ""}`} onClick={() => setPicked(l)}>
                <span className={`m m-${l.method}`}>{l.method}</span>
                <span className="grow">{l.path}</span>{l.mock && <span className="faint">가짜</span>}
                <span className={l.status >= 400 ? "bad" : "ok"}>{l.status}</span>
              </button>
            ))}
          </div>
          <pre className="api-log-detail">
            {picked ? `${picked.method} ${picked.path} → ${picked.status} (${picked.ms}ms)\n\n요청 본문:\n${JSON.stringify(picked.body ?? null, null, 2)}\n\n응답:\n${JSON.stringify(picked.response, null, 2)}` : "왼쪽에서 요청을 고르면 요청·응답 JSON이 보입니다.\n(1초마다 부르는 작업 확인 요청은 완료된 것만 표시)"}
          </pre>
        </div>
      )}
    </div>
  );
}
