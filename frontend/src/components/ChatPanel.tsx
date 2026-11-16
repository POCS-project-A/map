import { useEffect, useRef, useState } from "react";
import { getTrip, listMessages, revertRevision, sendMessage } from "../api/endpoints";
import type { Change, Message, Trip } from "../api/types";
import { STEP_LABEL, useJob } from "../hooks/useJob";
import ErrorBox from "./ErrorBox";

// 오른쪽 AI 영역: 대화(11, 12) → 작업 대기(13) → 끝나면 이미 바뀐 일정을 다시 불러온다(3)
export default function ChatPanel({ tripId, initialJob, track, onBusyChange, onChanges, onClose }: {
  tripId: number; initialJob: number | null; onBusyChange: (busy: boolean) => void;
  track: (request: Promise<Trip>) => Promise<boolean>; // 일정 반영 (가장 나중 요청만)
  onChanges: (changes: Change[]) => void; // 일정표에서 바뀐 칸을 강조하려고 위로 올린다
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState<number | null>(initialJob);
  const [sending, setSending] = useState(false); // 전송 요청 중: 작업 번호를 받기 전까지 다시 보내지 못하게
  // 대화 쪽 오류와 일정 쪽 오류를 따로 둔다 (한쪽 다시 시도 버튼이 다른 쪽 오류에 덮이지 않게)
  type Err = { title: string; error: unknown; retry?: () => void } | null;
  const [chatError, setChatError] = useState<Err>(null);
  const [tripError, setTripError] = useState<Err>(null);
  const latestMessages = useRef(0); // 대화 목록도 가장 나중 요청의 응답만 반영
  const bottom = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    const n = ++latestMessages.current;
    try {
      const list = await listMessages(tripId);
      if (n === latestMessages.current) { setMessages(list); setChatError(null); }
    } catch (e) {
      if (n === latestMessages.current) setChatError({ title: "대화 기록을 불러오지 못했어요", error: e, retry: loadMessages });
    }
  }
  useEffect(() => { loadMessages(); }, [tripId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, jobId]);
  useEffect(() => { onBusyChange(jobId != null || sending); }, [jobId, sending]);

  // AI 작업이 끝난 뒤: 바뀐 일정과 대화를 각각 다시 불러온다. 한쪽이 실패해도 다른 쪽은 진행하고, 다시 시도할 수 있다.
  async function refreshTrip(changes: Change[]) {
    setTripError(null);
    try { if (await track(getTrip(tripId))) onChanges(changes); } // 그사이 되돌리기 등 더 새 요청이 있으면 버린다
    catch (e) { setTripError({ title: "바뀐 일정을 불러오지 못했어요", error: e, retry: () => refreshTrip(changes) }); }
  }

  async function revert(m: Message) {
    setTripError(null);
    try {
      if (await track(revertRevision(tripId, m.revision_id!))) onChanges([]); // 14
      loadMessages();
    } catch (e) { setTripError({ title: "되돌리지 못했어요", error: e }); }
  }

  const job = useJob(jobId, (j) => {
    setJobId(null);
    if (j.status === "failed") setChatError({ title: "AI 작업이 실패했어요", error: new Error(j.error ?? "원인을 알 수 없어요") });
    loadMessages();
    if (j.status === "done") refreshTrip(j.result?.message?.changes ?? []);
  });

  async function send() {
    const t = text.trim();
    if (!t || jobId || sending) return;
    setSending(true); setChatError(null);
    try {
      const { job_id } = await sendMessage(tripId, t);
      setText("");
      setJobId(job_id);
      loadMessages();
    } catch (e) {
      setChatError({ title: "메시지를 보내지 못했어요", error: e }); // 입력한 글은 지우지 않고 남겨 둔다
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
        {tripError && <ErrorBox title={tripError.title} error={tripError.error} onRetry={tripError.retry} />}
        {chatError && <ErrorBox title={chatError.title} error={chatError.error} onRetry={chatError.retry} />}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={locked ? "AI가 작업 중이에요…" : "예: 경복궁 다음은 버스로 바꿔줘"} disabled={locked} />
        <button className="send" disabled={locked || !text.trim()} aria-label="보내기">↑</button>
      </form>
    </aside>
  );
}
