import { useState } from "react";
import { addItem, deleteItem, reorderDay, updateItem } from "../api/endpoints";
import type { PlaceItem, RouteItem, Trip, TravelMode } from "../api/types";
import { fmtMin, MODE_LABEL, slackMinutes, won } from "../lib/format";
import PlaceSearch from "./PlaceSearch";

interface Props {
  trip: Trip;
  readOnly?: boolean;
  selectedRoute: number | null;
  onSelectRoute: (dayNo: number, itemId: number | null) => void;
  onDayFocus: (dayNo: number) => void;
  onTripChange?: (trip: Trip) => void;
}

export default function Timeline({ trip, readOnly, selectedRoute, onSelectRoute, onDayFocus, onTripChange }: Props) {
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function run(p: Promise<Trip>) {
    setError("");
    try { onTripChange?.(await p); } catch (e) { setError((e as Error).message); }
  }

  function move(dayNo: number, places: PlaceItem[], index: number, dir: -1 | 1) {
    const ids = places.map((p) => p.item_id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(reorderDay(trip.trip_id, dayNo, ids)); // 10
  }

  return (
    <div className="timeline">
      {error && <p className="error">{error}</p>}
      {trip.days.map((day) => {
        const places = day.items.filter((i): i is PlaceItem => i.type === "place");
        return (
          <section key={day.day_no} onMouseEnter={() => onDayFocus(day.day_no)}>
            <div className="day-head">
              <b>{day.day_no}일차</b>
              <span className="muted small">{day.date}</span>
            </div>
            {day.items.length === 0 && <p className="muted small" style={{ padding: "4px 16px" }}>아직 장소가 없어요.</p>}
            {day.items.map((it) =>
              it.type === "place" ? (
                <PlaceRow
                  key={it.item_id} item={it} num={places.indexOf(it) + 1} readOnly={readOnly}
                  onMemo={(memo) => run(updateItem(trip.trip_id, it.item_id, { memo }))} // 8
                  onDelete={() => run(deleteItem(trip.trip_id, it.item_id))} // 9
                  onUp={() => move(day.day_no, places, places.indexOf(it), -1)}
                  onDown={() => move(day.day_no, places, places.indexOf(it), 1)}
                />
              ) : (
                <RouteRow
                  key={it.item_id} item={it} readOnly={readOnly} selected={selectedRoute === it.item_id}
                  onSelect={() => onSelectRoute(day.day_no, selectedRoute === it.item_id ? null : it.item_id)}
                  onMode={(mode) => run(updateItem(trip.trip_id, it.item_id, { mode }))} // 8
                />
              ),
            )}
            {!readOnly && (addingDay === day.day_no ? (
              <PlaceSearch
                onCancel={() => setAddingDay(null)}
                onPick={(place) => { setAddingDay(null); run(addItem(trip.trip_id, { day_no: day.day_no, place })); }} // 7
              />
            ) : (
              <button className="btn-text add" onClick={() => setAddingDay(day.day_no)}>+ 장소 추가</button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function PlaceRow({ item, num, readOnly, onMemo, onDelete, onUp, onDown }: {
  item: PlaceItem; num: number; readOnly?: boolean;
  onMemo: (m: string) => void; onDelete: () => void; onUp: () => void; onDown: () => void;
}) {
  const [memo, setMemo] = useState(item.memo);
  return (
    <div className="item">
      <span className="time">{item.start_time}</span>
      <span className="num">{num}</span>
      <div className="place-card">
        <div className="row">
          <span className="small muted">{item.place.category}</span>
          <span className="grow" />
          {!readOnly && <>
            <button className="btn-icon" title="위로" onClick={onUp}>↑</button>
            <button className="btn-icon" title="아래로" onClick={onDown}>↓</button>
            <button className="btn-icon" title="삭제" onClick={onDelete}>✕</button>
          </>}
        </div>
        <b>{item.place.name}</b>
        <div className="chips">
          <span>{item.start_time}–{item.end_time}</span>
          {item.estimated_cost > 0 && <span>{won(item.estimated_cost)}</span>}
        </div>
        {item.summary && <p className="small muted">{item.summary}</p>}
        {readOnly ? (item.memo && <p className="memo">{item.memo}</p>) : (
          <input
            className="memo" value={memo} placeholder="메모 추가…"
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => memo !== item.memo && onMemo(memo)}
          />
        )}
      </div>
    </div>
  );
}

function RouteRow({ item, readOnly, selected, onSelect, onMode }: {
  item: RouteItem; readOnly?: boolean; selected: boolean; onSelect: () => void; onMode: (m: TravelMode) => void;
}) {
  const slack = slackMinutes(item);
  return (
    <div className="item">
      <span className="time muted">{item.start_time}</span>
      <span />
      <div className={`route ${selected ? "sel" : ""}`} onClick={onSelect}>
        {readOnly ? <span>{MODE_LABEL[item.mode]}</span> : (
          <select value={item.mode} onClick={(e) => e.stopPropagation()} onChange={(e) => onMode(e.target.value as TravelMode)}>
            {(Object.keys(MODE_LABEL) as TravelMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
        )}
        <span>{fmtMin(item.travel_minutes)}</span>
        <span className={slack >= 0 ? "ok" : "bad"}>{slack >= 0 ? `여유 ${fmtMin(slack)}` : `⚠ ${fmtMin(-slack)} 부족`}</span>
        <span className="grow" />
        <span className="small muted">{(item.distance_m / 1000).toFixed(1)}km</span>
      </div>
    </div>
  );
}
