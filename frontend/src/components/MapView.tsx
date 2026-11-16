import { useEffect, useRef, useState } from "react";
import type { PlaceItem, RouteItem, Trip } from "../api/types";

// 네이버 지도에 그날 장소(번호 마커)와 이동 경로(선)를 그린다.
// 지도 스크립트를 못 불러오거나 인증에 실패하면(예: 콘솔에 등록 안 된 주소) 평면 자리표시 지도로 대신한다.

declare global {
  interface Window {
    naver?: any; // 네이버 지도 JS v3 (타입 패키지 없음)
    navermap_authFailure?: () => void; // 인증 실패 시 네이버 스크립트가 부르는 함수
  }
}

// 기존 frontend/index.html(네이버 지도 연동)에서 쓰던 클라이언트 ID. .env로 바꿀 수 있다.
const CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID || "wwwbprot7z";

let loading: Promise<boolean> | null = null;
let authFailed = false;
function loadNaverMaps(): Promise<boolean> {
  if (authFailed) return Promise.resolve(false);
  if (window.naver?.maps) return Promise.resolve(true);
  loading ??= new Promise((resolve) => {
    window.navermap_authFailure = () => {
      authFailed = true;
      window.dispatchEvent(new Event("naver-auth-failure"));
      resolve(false);
    };
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}`;
    s.onload = () => resolve(!!window.naver?.maps && !authFailed);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return loading;
}

const hasCoord = (p: PlaceItem) => Number.isFinite(p.place.lat) && Number.isFinite(p.place.lng);

export default function MapView({ trip, dayNo, selectedRoute }: { trip: Trip; dayNo: number; selectedRoute: number | null }) {
  const [all, setAll] = useState(false);
  const [mode, setMode] = useState<"loading" | "naver" | "fallback">("loading");
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<any[]>([]);

  const day = trip.days.find((d) => d.day_no === dayNo) ?? trip.days[0];
  // 번호는 일정표와 같게 (좌표 없는 장소를 지도에서 빼도 번호는 그대로)
  const allPlaces = (day?.items ?? []).filter((i): i is PlaceItem => i.type === "place");
  const numOf = new Map(allPlaces.map((p, i) => [p.item_id, i + 1]));
  const places = allPlaces.filter(hasCoord);
  const routes = (day?.items ?? []).filter((i): i is RouteItem => i.type === "route");
  const shown = routes.filter((r) => all || r.item_id === selectedRoute);

  // 지도 스크립트 불러오기
  useEffect(() => {
    let alive = true;
    loadNaverMaps().then((ok) => alive && setMode(ok ? "naver" : "fallback"));
    const onFail = () => alive && setMode("fallback");
    addEventListener("naver-auth-failure", onFail);
    return () => { alive = false; removeEventListener("naver-auth-failure", onFail); };
  }, []);

  // 지도 만들기 (한 번)
  useEffect(() => {
    if (mode !== "naver" || !box.current || map.current) return;
    const { maps } = window.naver;
    map.current = new maps.Map(box.current, { center: new maps.LatLng(37.5665, 126.978), zoom: 13 });
  }, [mode]);

  // 마커와 경로 다시 그리기
  useEffect(() => {
    if (mode !== "naver" || !map.current) return;
    const { maps } = window.naver;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    const bounds = new maps.LatLngBounds();
    places.forEach((p) => {
      const pos = new maps.LatLng(p.place.lat, p.place.lng);
      bounds.extend(pos);
      overlays.current.push(new maps.Marker({
        position: pos, map: map.current, title: `${p.place.name} ${p.start_time}`,
        icon: { content: `<div class="npin${p.place.category === "숙소" ? " lodging" : ""}">${numOf.get(p.item_id)}</div>`, anchor: new maps.Point(14, 14) },
      }));
    });
    shown.forEach((r) => {
      overlays.current.push(new maps.Polyline({
        map: map.current, path: r.path.map(([lng, lat]) => new maps.LatLng(lat, lng)),
        strokeColor: "#0075de", strokeWeight: 4, strokeOpacity: 0.9, strokeStyle: r.mode === "walk" ? "shortdot" : "solid",
      }));
    });
    if (places.length > 1) map.current.fitBounds(bounds);
    else if (places.length === 1) map.current.setCenter(new maps.LatLng(places[0].place.lat, places[0].place.lng));
  }, [mode, trip, dayNo, selectedRoute, all]);

  return (
    <div className="map">
      <div className="map-tools">
        <span className="pill">{day ? `${day.day_no}일차 · ${allPlaces.length}곳${allPlaces.length > places.length ? ` (좌표 없음 ${allPlaces.length - places.length})` : ""}` : "일정 없음"}</span>
        <label className="pill"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> 전체 경로</label>
      </div>
      {mode === "naver" ? (
        // 네이버 지도는 지도 상자에 position: relative를 덮어쓰므로, 바깥 상자로 크기를 잡는다
        <div className="naver-map"><div ref={box} style={{ width: "100%", height: "100%" }} /></div>
      ) : <FlatMap places={places} shown={shown} numOf={numOf} />}
      {mode !== "naver" && (
        <span className="map-note">
          {mode === "loading" ? "지도 불러오는 중…" : "네이버 지도를 쓸 수 없어 자리표시 지도로 보여 줍니다 (인증 실패 또는 연결 안 됨)"}
        </span>
      )}
    </div>
  );
}

// 네이버 지도를 못 쓸 때: 위도·경도를 평면에 그대로 찍는다 (번호 마커 + 직선 경로)
function FlatMap({ places, shown, numOf }: { places: PlaceItem[]; shown: RouteItem[]; numOf: Map<number, number> }) {
  const pts = places.map((p) => p.place);
  const minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng));
  const pad = 0.15;
  const x = (lng: number) => (pts.length < 2 ? 50 : (pad + (1 - 2 * pad) * (lng - minLng) / (maxLng - minLng || 1)) * 100);
  const y = (lat: number) => (pts.length < 2 ? 50 : (pad + (1 - 2 * pad) * (maxLat - lat) / (maxLat - minLat || 1)) * 100);
  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="map-svg">
        {shown.map((r) => (
          <polyline key={r.item_id} fill="none" stroke="#0075de" strokeWidth={0.8} strokeLinecap="round"
            strokeDasharray={r.mode === "walk" ? "0.2 1.6" : undefined}
            points={r.path.map(([lng, lat]) => `${x(lng)},${y(lat)}`).join(" ")} />
        ))}
      </svg>
      {places.map((p) => (
        <div key={p.item_id} className="pin" style={{ left: `${x(p.place.lng)}%`, top: `${y(p.place.lat)}%` }} title={`${p.place.name} ${p.start_time}`}>
          {numOf.get(p.item_id)}
        </div>
      ))}
    </>
  );
}
