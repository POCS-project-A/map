import { useEffect, useRef, useState } from "react";
import { claimTrip, getTrip, updateTrip } from "../api/endpoints";
import type { Change, Trip } from "../api/types";
import ChatPanel from "../components/ChatPanel";
import ErrorBox from "../components/ErrorBox";
import CostPanel from "../components/CostPanel";
import MapView from "../components/MapView";
import Timeline from "../components/Timeline";
import { go } from "../lib/nav";

// 일정 상세: 왼쪽(일정 또는 비용) | 가운데 지도(항상) | 오른쪽 AI(토글)
export default function TripPage({ tripId, jobId }: { tripId: number; jobId: number | null }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<{ title: string; error: unknown } | null>(null);
  const [retry, setRetry] = useState(0);

  // 일정을 바꾸는 요청(직접 편집, AI 결과 조회, 되돌리기, 제목 저장)은 모두 여기를 거친다.
  // 요청마다 보낸 순서대로 번호를 붙이고, 지금 화면에 반영된 것보다 나중에 보낸 요청의 결과만 반영한다.
  // - 늦게 도착한 옛 응답은 버린다 (예: 되돌리기 뒤에 도착한 AI 결과 조회 응답)
  // - 뒤에 보낸 요청이 실패해도, 앞서 성공한 결과(예: 되돌리기)는 반영된다
  // 반환값: 반영했으면 true, 이미 더 새 결과가 반영돼 있어 버렸으면 false
  const sent = useRef(0);
  const shown = useRef(0);
  async function track(request: Promise<Trip>): Promise<boolean> {
    const n = ++sent.current;
    const t = await request;
    if (n < shown.current) return false;
    shown.current = n;
    setTrip(t);
    return true;
  }
  const [leftTab, setLeftTab] = useState<"plan" | "cost">("plan"); // 둘 중 하나만
  const [showAi, setShowAi] = useState(true);
  const [aiChanges, setAiChanges] = useState<Change[]>([]); // 마지막 AI 변경: 일정표에서 강조
  const [aiBusy, setAiBusy] = useState(false); // AI가 일정을 바꾸는 중이면 직접 편집을 막는다 (서버도 409)
  const [dayNo, setDayNo] = useState(1);
  const [route, setRoute] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setError(null);
    getTrip(tripId).then((t) => { setTrip(t); setTitle(t.title); }).catch(setError); // 3
  }, [tripId, retry]);

  if (error) return (
    <div style={{ padding: 24 }} className="col">
      <ErrorBox title="여행을 불러오지 못했어요" error={error} onRetry={() => setRetry((n) => n + 1)} />
      <button className="btn" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => go("/")}>라이브러리로</button>
    </div>
  );
  if (!trip) return <p className="muted" style={{ padding: 24 }}>불러오는 중…</p>;

  const cols = "minmax(380px, 30%) 1fr";

  async function saveTitle() {
    if (!trip || title === trip.title) return;
    setActionError(null);
    try { await track(updateTrip(trip.trip_id, { title })); } // 4
    catch (e) { setActionError({ title: "제목을 저장하지 못했어요 (입력란에서 다시 나가면 재시도)", error: e }); }
  }
  async function share() {
    const url = `${location.origin}${location.pathname}#/shared/${trip!.share_token}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    setNotice(`공유 링크를 복사했어요: ${url}`);
  }
  async function claim() {
    setActionError(null);
    try {
      await claimTrip(trip!.trip_id); // 6
      setNotice("내 계정에 저장했어요.");
    } catch (e) { setActionError({ title: "내 계정에 저장하지 못했어요", error: e }); }
  }

  return (
    <div className="trip-page">
      <nav className="rail">
        <button className="rail-btn" title="라이브러리로" onClick={() => go("/")}>←</button>
        <hr />
        <button className={`rail-btn ${leftTab === "plan" ? "on" : ""}`} onClick={() => setLeftTab("plan")}><span>📅</span>일정</button>
        <button className={`rail-btn ${leftTab === "cost" ? "on" : ""}`} onClick={() => setLeftTab("cost")}><span>₩</span>비용</button>
      </nav>
      <div className="trip-main">
        <header className="topbar">
          <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} disabled={aiBusy} title={aiBusy ? "AI 작업 중에는 바꿀 수 없어요" : "여행 제목"} />
          <span className="muted small">{trip.start_date ?? "날짜 미정"} · {trip.day_count}일</span>
          <span className="grow" />
          {notice && <span className="small notice">{notice}</span>}
          <button className="btn" onClick={share}>공유</button>
          <button className="btn" onClick={claim}>내 계정에 저장</button>
        </header>
        {actionError && <div className="action-error"><ErrorBox title={actionError.title} error={actionError.error} /><button className="btn-text" onClick={() => setActionError(null)}>닫기</button></div>}
        <div className="trip-layout" style={{ gridTemplateColumns: cols || "1fr" }}>
          <aside className="panel">
              <div className="panel-head"><h2>{leftTab === "plan" ? "일정" : "비용"}</h2></div>
              {aiBusy && <div className="busy">✦ AI가 일정을 바꾸는 중이에요. 끝나면 다시 편집할 수 있어요.</div>}
              <div className="panel-body">
                {leftTab === "plan" ? (
                  <Timeline
                    trip={trip} readOnly={aiBusy} selectedRoute={route} onDayFocus={setDayNo}
                    changes={aiChanges} onDismissChanges={() => setAiChanges([])}
                    track={track} onEdited={() => setAiChanges([])}
                    onSelectRoute={(d, id) => { setDayNo(d); setRoute(id); }}
                  />
                ) : <CostPanel trip={trip} />}
              </div>
          </aside>
          <div className="map-area">
            <MapView trip={trip} dayNo={dayNo} selectedRoute={route} />
            <div className="chatbot" hidden={!showAi}>
              <ChatPanel
                tripId={trip.trip_id} initialJob={jobId} track={track} onBusyChange={setAiBusy}
                onChanges={setAiChanges} onClose={() => setShowAi(false)}
              />
            </div>
            {!showAi && (
              <button className="chatbot-fab" onClick={() => setShowAi(true)} title="AI 여행 도우미 열기">
                ✦<span>AI</span>{aiBusy && <i className="fab-dot" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
