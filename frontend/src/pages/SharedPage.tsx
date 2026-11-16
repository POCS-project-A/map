import { useEffect, useState } from "react";
import { getShared } from "../api/endpoints";
import type { Trip } from "../api/types";
import Timeline from "../components/Timeline";
import MapView from "../components/MapView";

// 공유 링크로 들어온 사람이 보는 읽기 전용 화면 (명세서 18번)
export default function SharedPage({ token }: { token: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  const [day, setDay] = useState(1);
  useEffect(() => { getShared(token).then(setTrip).catch((e) => setError(e.message)); }, [token]);
  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>;
  if (!trip) return <p className="muted" style={{ padding: 24 }}>불러오는 중…</p>;
  return (
    <div className="trip-layout" style={{ gridTemplateColumns: "420px 1fr" }}>
      <aside className="panel">
        <div className="panel-head"><div><span className="muted small">공유받은 일정 · 읽기 전용</span><h2>{trip.title}</h2></div></div>
        <div className="panel-body"><Timeline trip={trip} readOnly selectedRoute={null} onSelectRoute={() => {}} onDayFocus={setDay} /></div>
      </aside>
      <MapView trip={trip} dayNo={day} selectedRoute={null} />
    </div>
  );
}
