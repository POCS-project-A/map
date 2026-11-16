import { useEffect, useState } from "react";
import { getShared } from "../api/endpoints";
import type { Trip } from "../api/types";
import ErrorBox from "../components/ErrorBox";
import MapView from "../components/MapView";
import Timeline from "../components/Timeline";

// 공유 링크로 들어온 사람이 보는 읽기 전용 화면 (명세서 15번)
export default function SharedPage({ token }: { token: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [day, setDay] = useState(1);
  const [route, setRoute] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // 링크가 바뀌면 이전 링크의 늦게 온 응답은 무시한다
    let alive = true;
    setTrip(null); setError(null);
    getShared(token).then((t) => alive && setTrip(t)).catch((e) => alive && setError(e));
    return () => { alive = false; };
  }, [token, retry]);

  if (error) return <div style={{ padding: 24 }}><ErrorBox title="공유된 일정을 불러오지 못했어요" error={error} onRetry={() => setRetry((n) => n + 1)} /></div>;
  if (!trip) return <p className="muted" style={{ padding: 24 }}>불러오는 중…</p>;
  return (
    <div className="trip-layout" style={{ gridTemplateColumns: "420px 1fr", height: "100%" }}>
      <aside className="panel">
        <div className="panel-head"><div><span className="muted small">공유받은 일정 · 읽기 전용</span><h2>{trip.title}</h2></div></div>
        <div className="panel-body"><Timeline trip={trip} readOnly selectedRoute={route} onSelectRoute={(d, id) => { setDay(d); setRoute(id); }} onDayFocus={setDay} /></div>
      </aside>
      <div className="map-area"><MapView trip={trip} dayNo={day} selectedRoute={route} /></div>
    </div>
  );
}
