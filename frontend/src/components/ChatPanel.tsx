import { useEffect, useRef, useState } from "react";
import { applySuggestion, dismissSuggestion, getTrip, listMessages, listSuggestions, sendMessage } from "../api/endpoints";
import type { Message, Suggestion, Trip } from "../api/types";
import { STEP_LABEL, useJob } from "../hooks/useJob";

// 오른쪽 AI 영역: 대화(12, 13) → 작업 대기(14) → 제안 적용·무시(15, 16, 17)
export default function ChatPanel({ tripId, initialJob, onTripChange }: {
  tripId: number; initialJob: number | null; onTripChange: (t: Trip) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<number | null>(initialJob);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const reload = () => Promise.all([listMessages(tripId).then(setMessages), listSuggestions(tripId).then(setSuggestions)]);
  useEffect(() => { reload().catch((e) => setError(e.message)); }, [tripId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, jobId]);

  const job = useJob(jobId, async (j) => {
    setJobId(null);
    if (j.status === "failed") setError(j.error ?? "AI 작업이 실패했어요");
    await reload();
    if (j.result?.trip_id) onTripChange(await getTrip(tripId));
  });

  async function send() {
    const t = text.trim();
    if (!t || jobId) return;
    setText(""); setError("");
    try {
      const { job_id } = await sendMessage(tripId, t);
      setJobId(job_id);
      setMessages(await listMessages(tripId));
    } catch (e) { setError((e as Error).message); }
  }

  async function apply(s: Suggestion) {
    try { onTripChange(await applySuggestion(s.suggestion_id)); setSuggestions(await listSuggestions(tripId)); }
    catch (e) { setError((e as Error).message); }
  }
  async function dismiss(s: Suggestion) {
    try { await dismissSuggestion(s.suggestion_id); setSuggestions(await listSuggestions(tripId)); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <aside className="panel chat">
      <div className="panel-head"><div><h2>✦ AI 여행 도우미</h2><span className="muted small">말로 일정을 만들고 고쳐요</span></div></div>
      <div className="panel-body msgs">
        {messages.map((m) => <div key={m.message_id} className={`msg ${m.role}`}>{m.text}</div>)}
        {job && job.status !== "done" && (
          <div className="msg assistant waiting">⏳ {job.step ? STEP_LABEL[job.step] : "대기 중"}…</div>
        )}
        {suggestions.length > 0 && <div className="small muted" style={{ marginTop: 8 }}>AI 제안 {suggestions.length}개</div>}
        {suggestions.map((s) => (
          <div key={s.suggestion_id} className="suggestion">
            <b>{s.title}</b>
            {s.changes.map((c, i) => (
              <div key={i} className="small muted">항목 {c.item_id} · {c.field}: {String(c.before)} → <b>{String(c.after)}</b></div>
            ))}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn-primary" onClick={() => apply(s)}>적용</button>
              <button className="btn" onClick={() => dismiss(s)}>무시</button>
            </div>
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={jobId ? "AI가 작업 중이에요…" : "예: 경복궁 다음은 버스로 바꿔줘"} disabled={!!jobId} />
        <button className="btn-primary" disabled={!!jobId || !text.trim()}>보내기</button>
      </form>
    </aside>
  );
}
