import { useState } from "react";
import { searchPlaces } from "../api/endpoints";
import type { Place } from "../api/types";

type Found = Omit<Place, "place_id">;

// 장소 검색 (명세서 11번) → 고르면 부모가 장소 추가(7번)를 부른다
export default function PlaceSearch({ onPick, onCancel }: { onPick: (p: Found) => void; onCancel: () => void }) {
  const [kw, setKw] = useState("");
  const [result, setResult] = useState<Found[] | null>(null);
  const [error, setError] = useState("");
  async function search() {
    setError("");
    try { setResult((await searchPlaces(kw)).places); } catch (e) { setError((e as Error).message); }
  }
  return (
    <div className="search-box">
      <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="장소 이름 (예: 창경궁)" />
        <button className="btn">검색</button>
        <button type="button" className="btn-text" onClick={onCancel}>취소</button>
      </form>
      {error && <p className="error">{error}</p>}
      {result?.map((p) => (
        <button key={p.name + p.address} className="search-result" onClick={() => onPick(p)}>
          <b>{p.name}</b> <span className="muted small">{p.category} · {p.address}</span>
        </button>
      ))}
    </div>
  );
}
