import { useEffect, useRef, useState } from "react";
import { getTrip, listMessages, revertRevision, sendMessage } from "../api/endpoints";
import type { Change, Message, Trip } from "../api/types";
import { STEP_LABEL, useJob } from "../hooks/useJob";

// 오른쪽 AI 영역: 대화(11, 12) → 작업 대기(13) → 끝나면 이미 바뀐 일정을 다시 불러온다(3)
export default function ChatPanel({ tripId, initialJob, onTripChange, onBusyChange, onChanges, onClose }: {
  tripId: number; initialJob: number | null; onTripChange: (t: Trip) => void; onBusyChange: (busy: boolean) => void;
  onChanges: (changes: Change[]) => void; // 일정표에서 바뀐 칸을 강조하려고 위로 올린다
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<number | null>(initialJob);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { listMessages(tripId).then(setMessages).catch((e) => setError(e.message)); }, [tripId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, jobId]);

  useEffect(() => { onBusyChange(jobId != null); }, [jobId]);

  async function revert(m: Message) {
    setError("");
    try {
      onTripChange(await revertRevision(tripId, m.revision_id!)); // 14
      onChanges([]);
      setMessages(await listMessages(tripId));
    } catch (e) { setError((e as Error).message); }
  }

  const job = useJob(jobId, async (j) => {
    setJobId(null);
    if (j.status === "failed") setError(j.error ?? "AI 작업이 실패했어요");
    setMessages(await listMessages(tripId));
    if (j.status === "done") {
      onTripChange(await getTrip(tripId));
      onChanges(j.result?.message?.changes ?? []);
    }
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

  return (
    <aside className="panel chat">
      <div className="panel-head chat-head">
        <h2 className="grow">✦ AI 여행 도우미</h2>
        <button className="btn-icon close" onClick={onClose} title="닫기" aria-label="AI 창 닫기">✕</button>
      </div>
      <div className="panel-body msgs">
        {messages.map((m) => (
          <div key={m.message_id} className={`msg ${m.role}`}>
            {m.text}
            {m.changes && (
              <div className={`changes ${m.reverted ? "reverted" : ""}`}>
                <div className="small muted">바뀐 것{m.reverted ? " · 되돌림" : ""}</div>
                {m.changes.map((c) => (
                  <div key={c.item_id} className="change-row">
                    <b>{c.summary}</b> {c.kind === "added" ? <span>추가 {c.after}</span> : c.kind === "removed" ? <s>삭제 {c.before}</s> : <><s>{c.before}</s> → <span>{c.after}</span></>}
                  </div>
                ))}
                {!m.reverted && <button className="btn" onClick={() => revert(m)}>↩ 되돌리기</button>}
              </div>
            )}
          </div>
        ))}
        {job && job.status !== "done" && job.status !== "failed" && (
          <div className="msg assistant waiting">⏳ {job.step ? STEP_LABEL[job.step] : "대기 중"}…</div>
        )}
        {error && <p className="error">{error}</p>}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={jobId ? "AI가 작업 중이에요…" : "예: 경복궁 다음은 버스로 바꿔줘"} disabled={!!jobId} />
        <button className="send" disabled={!!jobId || !text.trim()} aria-label="보내기">↑</button>
      </form>
    </aside>
  );
}
