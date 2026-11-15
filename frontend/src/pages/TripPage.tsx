import { useEffect, useState } from "react";
import { claimTrip, getTrip, updateTrip } from "../api/endpoints";
import type { Trip } from "../api/types";
import ChatPanel from "../components/ChatPanel";
import CostPanel from "../components/CostPanel";
import MapView from "../components/MapView";
import Timeline from "../components/Timeline";
import { go } from "../lib/nav";

// 일정 상세: 왼쪽 일정 | 가운데 지도 | 오른쪽 AI. 세 영역은 왼쪽 세로 탭바로 켜고 끈다.
export default function TripPage({ tripId, jobId }: { tripId: number; jobId: number | null }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  const [show, setShow] = useState({ plan: true, map: true, ai: true });
  const [leftTab, setLeftTab] = useState<"plan" | "cost">("plan");
  const [dayNo, setDayNo] = useState(1);
  const [route, setRoute] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getTrip(tripId).then((t) => { setTrip(t); setTitle(t.title); }).catch((e) => setError(e.message)); // 3
  }, [tripId]);

  if (error) return <p className="error" style={{ padding: 24 }}>{error} <button className="btn" onClick={() => go("/")}>라이브러리로</button></p>;
  if (!trip) return <p className="muted" style={{ padding: 24 }}>불러오는 중…</p>;

  const cols = [show.plan && "minmax(380px, 30%)", show.map && "1fr", show.ai && "minmax(340px, 28%)"].filter(Boolean).join(" ");
  const toggle = (k: keyof typeof show) => setShow((s) => ({ ...s, [k]: !s[k] }));

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
        <button className={`rail-btn ${show.plan ? "on" : ""}`} onClick={() => toggle("plan")}><span>📅</span>일정</button>
        <button className={`rail-btn ${show.map ? "on" : ""}`} onClick={() => toggle("map")}><span>🗺️</span>지도</button>
        <button className={`rail-btn ${show.ai ? "on" : ""}`} onClick={() => toggle("ai")}><span>✦</span>AI</button>
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
          {show.plan && (
            <aside className="panel">
              <div className="panel-head">
                <div className="seg">
                  <button className={leftTab === "plan" ? "on" : ""} onClick={() => setLeftTab("plan")}>일정</button>
                  <button className={leftTab === "cost" ? "on" : ""} onClick={() => setLeftTab("cost")}>비용</button>
                </div>
              </div>
              <div className="panel-body">
                {leftTab === "plan" ? (
                  <Timeline
                    trip={trip} selectedRoute={route} onTripChange={setTrip} onDayFocus={setDayNo}
                    onSelectRoute={(d, id) => { setDayNo(d); setRoute(id); }}
                  />
                ) : <CostPanel trip={trip} />}
              </div>
            </aside>
          )}
          {show.map && <MapView trip={trip} dayNo={dayNo} selectedRoute={route} />}
          {show.ai && <ChatPanel tripId={trip.trip_id} initialJob={jobId} onTripChange={setTrip} />}
        </div>
      </div>
    </div>
  );
}
