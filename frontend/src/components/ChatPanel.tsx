import { useEffect, useRef, useState } from "react";
import { getTrip, listMessages, revertRevision, sendMessage } from "../api/endpoints";
import type { Change, Message, Trip } from "../api/types";
import { STEP_LABEL, useJob } from "../hooks/useJob";
import ErrorBox from "./ErrorBox";

// 오른쪽 AI 영역: 대화(11, 12) → 작업 대기(13) → 끝나면 이미 바뀐 일정을 다시 불러온다(3)
export default function ChatPanel({ tripId, initialJob, onTripChange, onBusyChange, onChanges, onClose }: {
  tripId: number; initialJob: number | null; onTripChange: (t: Trip) => void; onBusyChange: (busy: boolean) => void;
  onChanges: (changes: Change[]) => void; // 일정표에서 바뀐 칸을 강조하려고 위로 올린다
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<number | null>(initialJob);
  const [sending, setSending] = useState(false); // 전송 요청 중: 작업 번호를 받기 전까지 다시 보내지 못하게
  const [error, setError] = useState<{ title: string; error: unknown; retry?: () => void } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    try { setMessages(await listMessages(tripId)); }
    catch (e) { setError({ title: "대화 기록을 불러오지 못했어요", error: e, retry: loadMessages }); }
  }
  useEffect(() => { loadMessages(); }, [tripId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, jobId]);
  useEffect(() => { onBusyChange(jobId != null || sending); }, [jobId, sending]);

  // AI 작업이 끝난 뒤: 바뀐 일정과 대화를 각각 다시 불러온다. 한쪽이 실패해도 다른 쪽은 진행하고, 다시 시도할 수 있다.
  async function refreshTrip(changes: Change[]) {
    try { onTripChange(await getTrip(tripId)); onChanges(changes); }
    catch (e) { setError({ title: "바뀐 일정을 불러오지 못했어요", error: e, retry: () => refreshTrip(changes) }); }
  }

  async function revert(m: Message) {
    setError(null);
    try {
      onTripChange(await revertRevision(tripId, m.revision_id!)); // 14
      onChanges([]);
      loadMessages();
    } catch (e) { setError({ title: "되돌리지 못했어요", error: e }); }
  }

  const job = useJob(jobId, (j) => {
    setJobId(null);
    if (j.status === "failed") setError({ title: "AI 작업이 실패했어요", error: new Error(j.error ?? "원인을 알 수 없어요") });
    loadMessages();
    if (j.status === "done") refreshTrip(j.result?.message?.changes ?? []);
  });

  async function send() {
    const t = text.trim();
    if (!t || jobId || sending) return;
    setSending(true); setError(null);
    try {
      const { job_id } = await sendMessage(tripId, t);
      setText("");
      setJobId(job_id);
      loadMessages();
    } catch (e) {
      setError({ title: "메시지를 보내지 못했어요", error: e }); // 입력한 글은 지우지 않고 남겨 둔다
    } finally {
      setSending(false);
    }
  }

  const locked = !!jobId || sending;
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
        {error && <ErrorBox title={error.title} error={error.error} onRetry={error.retry} />}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={locked ? "AI가 작업 중이에요…" : "예: 경복궁 다음은 버스로 바꿔줘"} disabled={locked} />
        <button className="send" disabled={locked || !text.trim()} aria-label="보내기">↑</button>
      </form>
    </aside>
  );
}
