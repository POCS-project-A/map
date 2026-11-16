import { useEffect, useState } from "react";
import { claimTrip, getTrip, updateTrip } from "../api/endpoints";
import type { Change, Trip } from "../api/types";
import ChatPanel from "../components/ChatPanel";
import CostPanel from "../components/CostPanel";
import MapView from "../components/MapView";
import Timeline from "../components/Timeline";
import { go } from "../lib/nav";

// 일정 상세: 왼쪽(일정 또는 비용) | 가운데 지도(항상) | 오른쪽 AI(토글)
export default function TripPage({ tripId, jobId }: { tripId: number; jobId: number | null }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  const [leftTab, setLeftTab] = useState<"plan" | "cost">("plan"); // 둘 중 하나만
  const [showAi, setShowAi] = useState(true);
  const [aiChanges, setAiChanges] = useState<Change[]>([]); // 마지막 AI 변경: 일정표에서 강조
  const [aiBusy, setAiBusy] = useState(false); // AI가 일정을 바꾸는 중이면 직접 편집을 막는다 (서버도 409)
  const [dayNo, setDayNo] = useState(1);
  const [route, setRoute] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getTrip(tripId).then((t) => { setTrip(t); setTitle(t.title); }).catch((e) => setError(e.message)); // 3
  }, [tripId]);

  if (error) return <p className="error" style={{ padding: 24 }}>{error} <button className="btn" onClick={() => go("/")}>라이브러리로</button></p>;
  if (!trip) return <p className="muted" style={{ padding: 24 }}>불러오는 중…</p>;

  const cols = "minmax(380px, 30%) 1fr";

  async function saveTitle() {
    if (!trip || title === trip.title) return;
    setTrip(await updateTrip(trip.trip_id, { title })); // 4
  }
  async function share() {
    const url = `${location.origin}${location.pathname}#/shared/${trip!.share_token}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    setNotice(`공유 링크를 복사했어요: ${url}`);
  }
  async function claim() {
    await claimTrip(trip!.trip_id); // 6
    setNotice("(가짜 서버) 내 계정에 저장했어요. 실제로는 로그인 후 호출됩니다.");
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
          <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} />
          <span className="muted small">{trip.start_date ?? "날짜 미정"} · {trip.day_count}일</span>
          <span className="grow" />
          {notice && <span className="small notice">{notice}</span>}
          <button className="btn" onClick={share}>공유</button>
          <button className="btn" onClick={claim}>내 계정에 저장</button>
        </header>
        <div className="trip-layout" style={{ gridTemplateColumns: cols || "1fr" }}>
          <aside className="panel">
              <div className="panel-head"><h2>{leftTab === "plan" ? "일정" : "비용"}</h2></div>
              {aiBusy && <div className="busy">✦ AI가 일정을 바꾸는 중이에요. 끝나면 다시 편집할 수 있어요.</div>}
              <div className="panel-body">
                {leftTab === "plan" ? (
                  <Timeline
                    trip={trip} readOnly={aiBusy} selectedRoute={route} onDayFocus={setDayNo}
                    changes={aiChanges} onDismissChanges={() => setAiChanges([])}
                    onTripChange={(t) => { setTrip(t); setAiChanges([]); }}
                    onSelectRoute={(d, id) => { setDayNo(d); setRoute(id); }}
                  />
                ) : <CostPanel trip={trip} />}
              </div>
          </aside>
          <div className="map-area">
            <MapView trip={trip} dayNo={dayNo} selectedRoute={route} />
            <div className="chatbot" hidden={!showAi}>
              <ChatPanel
                tripId={trip.trip_id} initialJob={jobId} onTripChange={setTrip} onBusyChange={setAiBusy}
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
