import { ApiError } from "../api/client";

// 요청 실패를 "무엇이 / 왜" 실패했는지와 함께 보여 준다. onRetry가 있으면 다시 시도 버튼을 단다.
export default function ErrorBox({ error, title, onRetry }: { error: unknown; title?: string; onRetry?: () => void }) {
  if (!error) return null;
  const e = error as Error;
  const api = error instanceof ApiError ? error : null;
  return (
    <div className="error-box" role="alert">
      <b>{title ?? "요청을 처리하지 못했어요"}</b>
      <span>{e.message}</span>
      {api && <span className="small faint">{api.request} → {api.status === 0 ? "연결 실패" : api.status}</span>}
      {onRetry && <button className="btn" onClick={onRetry}>다시 시도</button>}
    </div>
  );
}
