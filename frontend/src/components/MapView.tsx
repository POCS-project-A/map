import { useState } from "react";
import type { PlaceItem, RouteItem, Trip } from "../api/types";

// 실제 지도 대신 위도·경도를 그대로 평면에 찍는 자리표시용 지도.
// 지도 API를 붙일 때 이 컴포넌트만 바꾸면 된다. (번호 마커 + 직선 경로)
export default function MapView({ trip, dayNo, selectedRoute }: { trip: Trip; dayNo: number; selectedRoute: number | null }) {
  const [all, setAll] = useState(false);
  const day = trip.days.find((d) => d.day_no === dayNo) ?? trip.days[0];
  const places = (day?.items ?? []).filter((i): i is PlaceItem => i.type === "place");
  const routes = (day?.items ?? []).filter((i): i is RouteItem => i.type === "route");

  const pts = places.map((p) => p.place);
  const minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng));
  const pad = 0.15;
  const x = (lng: number) => (pts.length < 2 ? 50 : (pad + (1 - 2 * pad) * (lng - minLng) / (maxLng - minLng || 1)) * 100);
  const y = (lat: number) => (pts.length < 2 ? 50 : (pad + (1 - 2 * pad) * (maxLat - lat) / (maxLat - minLat || 1)) * 100);

  const shown = routes.filter((r) => all || r.item_id === selectedRoute);
  return (
    <div className="map">
      <div className="map-tools">
        <span className="pill">{day ? `${day.day_no}일차 · ${places.length}곳` : "일정 없음"}</span>
        <label className="pill"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> 전체 경로</label>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="map-svg">
        {shown.map((r) => (
          <polyline key={r.item_id} fill="none" stroke="#0075de" strokeWidth={0.8} strokeLinecap="round"
            strokeDasharray={r.mode === "walk" ? "0.2 1.6" : undefined}
            points={r.path.map(([lng, lat]) => `${x(lng)},${y(lat)}`).join(" ")} />
        ))}
      </svg>
      {places.map((p, i) => (
        <div key={p.item_id} className="pin" style={{ left: `${x(p.place.lng)}%`, top: `${y(p.place.lat)}%` }} title={`${p.place.name} ${p.start_time}`}>
          {i + 1}
        </div>
      ))}
      <span className="map-note">지도 자리 (지도 API 연결 전) · 일정 칸에 마우스를 올리면 그날이 표시됩니다</span>
    </div>
  );
}
