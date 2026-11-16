import { useRef, useState } from "react";
import { searchPlaces } from "../api/endpoints";
import type { Place } from "../api/types";
import ErrorBox from "./ErrorBox";

type Found = Omit<Place, "place_id">;

// 장소 검색 (명세서 10번) → 고르면 부모가 장소 추가(7번)를 부른다
export default function PlaceSearch({ onPick, onCancel }: { onPick: (p: Found, stayMinutes: number) => void; onCancel: () => void }) {
  const [kw, setKw] = useState("");
  const [stay, setStay] = useState(60);
  const [result, setResult] = useState<Found[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const latest = useRef(0); // 빠르게 두 번 검색해도 마지막 검색 결과만 반영한다

  async function search() {
    const id = ++latest.current;
    setError(null);
    try {
      const { places } = await searchPlaces(kw);
      if (id === latest.current) setResult(places);
    } catch (e) {
      if (id === latest.current) setError(e);
    }
  }
  return (
    <div className="search-box">
      <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="장소 이름 (예: 창경궁)" />
        <select value={stay} onChange={(e) => setStay(+e.target.value)} title="머무는 시간">
          {[30, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60}시간` : `${m}분`} 머물기</option>)}
        </select>
        <button className="btn">검색</button>
        <button type="button" className="btn-text" onClick={onCancel}>취소</button>
      </form>
      <ErrorBox title="장소를 검색하지 못했어요" error={error} onRetry={search} />
      {result?.length === 0 && <p className="muted small">검색 결과가 없어요.</p>}
      {result?.map((p) => (
        <button key={p.name + p.address} className="search-result" onClick={() => onPick(p, stay)}>
          <b>{p.name}</b> <span className="muted small">{p.category} · {p.address}</span>
        </button>
      ))}
    </div>
  );
}
