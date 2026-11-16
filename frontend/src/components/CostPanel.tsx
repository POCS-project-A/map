import type { Trip } from "../api/types";
import { tripCost, won } from "../lib/format";

// 비용은 별도 API 없이 항목의 estimated_cost를 합산 (API 명세)
export default function CostPanel({ trip }: { trip: Trip }) {
  const byCat = new Map<string, number>();
  for (const it of trip.days.flatMap((d) => d.items)) {
    const key = it.type === "place" ? it.place.category : "교통";
    byCat.set(key, (byCat.get(key) ?? 0) + it.estimated_cost);
  }
  return (
    <div style={{ padding: 16 }}>
      <span className="muted small">예상 총비용</span>
      <div className="big">{won(tripCost(trip))}</div>
      <h3>항목별</h3>
      {[...byCat].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <div key={k} className="cost-row"><span>{k}</span><span>{won(v)}</span></div>
      ))}
      <h3>일차별</h3>
      {trip.days.map((d) => (
        <div key={d.day_no} className="cost-row"><span>{d.day_no}일차</span><span>{won(d.items.reduce((s, i) => s + i.estimated_cost, 0))}</span></div>
      ))}
    </div>
  );
}
