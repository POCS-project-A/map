import type { RouteItem, Trip, TravelMode } from "../api/types";

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const won = (n: number) => `₩${n.toLocaleString()}`;
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);
export const MODE_LABEL: Record<TravelMode, string> = { car: "🚗 자동차", transit: "🚌 대중교통", walk: "🚶 도보" };

// 여유 시간 = 배정 시간 − 실제 이동 시간 (API 명세: 프론트가 계산)
export function slackMinutes(r: RouteItem) {
  return toMin(r.end_time) - toMin(r.start_time) - r.travel_minutes;
}

export function tripCost(trip: Trip) {
  return trip.days.flatMap((d) => d.items).reduce((s, i) => s + i.estimated_cost, 0);
}
