import { Fragment, useEffect, useRef, useState } from "react";
import { addItem, deleteItem, updateItem } from "../api/endpoints";
import type { Change, PlaceItem, RouteItem, Trip, TravelMode } from "../api/types";
import { fmtMin, MODE_LABEL, slackMinutes, won } from "../lib/format";
import ErrorBox from "./ErrorBox";
import PlaceSearch from "./PlaceSearch";

interface Props {
  trip: Trip;
  readOnly?: boolean;
  selectedRoute: number | null;
  onSelectRoute: (dayNo: number, itemId: number | null) => void;
  onDayFocus: (dayNo: number) => void;
  track?: (request: Promise<Trip>) => Promise<boolean>; // 결과 반영 (가장 나중 요청만)
  onEdited?: () => void;
  changes?: Change[]; // AI가 방금 바꾼 칸 → 강조 + "이전 → 이후" 표시
  onDismissChanges?: () => void;
}

export default function Timeline({ trip, readOnly, selectedRoute, onSelectRoute, onDayFocus, track, onEdited, changes = [], onDismissChanges }: Props) {
  const changeOf = (id: number) => changes.find((c) => c.item_id === id);
  // AI가 뺀 장소: 원래 있던 자리(after_item_id 뒤)에 빨간 취소선으로 남겨 보여 준다
  const removedAt = (dayNo: number, after: number | null, show: boolean) =>
    show && changes.filter((c) => c.kind === "removed" && c.day_no === dayNo && (c.after_item_id ?? null) === after).map((c) => (
      <div key={`rm-${c.item_id}`} className="item">
        <span className="time" />
        <span />
        <div className="place-card removed"><span className="change-tag">✦ AI가 뺌</span><b>{c.summary}</b><span className="small">{c.before}</span></div>
      </div>
    ));
  // 장소 추가 창 위치: 어느 날, 어느 장소 뒤 (after = null이면 그날 맨 앞)
  const [adding, setAdding] = useState<{ day: number; after: number | null } | null>(null);
  const [error, setError] = useState<unknown>(null);

  // 편집 요청은 한 줄로 세워 순서대로 보낸다. (예: 이동수단을 빠르게 두 번 바꾸면 마지막 선택이 최종 결과)
  const queue = useRef<Promise<void>>(Promise.resolve());
  function run(request: () => Promise<Trip>) {
    setError(null);
    queue.current = queue.current.then(async () => {
      try { if (track && await track(request())) onEdited?.(); } catch (e) { setError(e); }
    });
  }

  // 끌어서 옮기기: 같은 날이든 다른 날이든. 놓으면 "그 날, 그 장소 뒤"를 보낸다 (8번 PATCH)
  const [drag, setDrag] = useState<{ day: number; id: number } | null>(null);
  const [over, setOver] = useState<number | string | null>(null); // 장소 번호, 또는 "end-{일차}"
  function moveTo(dayNo: number, after: number | null) {
    if (!drag) return;
    const id = drag.id;
    run(() => updateItem(trip.trip_id, id, { day_no: dayNo, after_item_id: after })); // 8
  }
  function drop(dayNo: number, places: PlaceItem[], targetId: number) {
    if (!drag || drag.id === targetId) return;
    const others = places.filter((p) => p.item_id !== drag.id);
    const t = others.findIndex((p) => p.item_id === targetId);
    // 같은 날에서 아래로 끌면 대상 뒤에, 그 밖에는 대상 앞에 넣는다
    const sameDayDown = drag.day === dayNo && places.findIndex((p) => p.item_id === drag.id) < places.findIndex((p) => p.item_id === targetId);
    const after = sameDayDown ? targetId : (others[t - 1]?.item_id ?? null);
    moveTo(dayNo, after);
  }

  // 장소 추가 (7번): 고른 장소를 after 뒤에 넣고, 시각은 서버가 다시 계산한다
  function search(dayNo: number, after: number | null) {
    return (
      <PlaceSearch
        onCancel={() => setAdding(null)}
        onPick={(place, stay) => { setAdding(null); run(() => addItem(trip.trip_id, { day_no: dayNo, after_item_id: after, place, stay_minutes: stay })); }}
      />
    );
  }

  return (
    <div className="timeline">
      <ErrorBox title="일정을 바꾸지 못했어요" error={error} />
      {changes.length > 0 && (
        <div className="changed-banner">
          ✦ AI가 {changes.length}곳을 바꿨어요. 아래 색으로 표시된 칸을 확인하세요 (초록 추가 · 파랑 변경 · 빨강 삭제).
          <button className="btn-text" onClick={onDismissChanges}>확인</button>
        </div>
      )}
      {trip.days.map((day) => {
        const places = day.items.filter((i): i is PlaceItem => i.type === "place");
        return (
          <section key={day.day_no} onMouseEnter={() => onDayFocus(day.day_no)}>
            <div className="day-head">
              <b>{day.day_no}일차</b>
              <span className="muted small">{day.date}</span>
            </div>
            {day.items.length === 0 && <p className="muted small" style={{ padding: "4px 16px" }}>아직 장소가 없어요.</p>}
            {places.length === 0 && removedAt(day.day_no, null, true)}
            {day.items.map((it) =>
              it.type === "place" ? (
                <Fragment key={it.item_id}>
                {removedAt(day.day_no, null, places[0]?.item_id === it.item_id)}
                <PlaceRow
                  item={it} change={changeOf(it.item_id)} num={places.indexOf(it) + 1} readOnly={readOnly}
                  onAddAfter={() => setAdding({ day: day.day_no, after: it.item_id })}
                  onMemo={(memo) => run(() => updateItem(trip.trip_id, it.item_id, { memo }))} // 8
                  onDelete={() => run(() => deleteItem(trip.trip_id, it.item_id))} // 9
                  dragging={drag?.id === it.item_id}
                  over={over === it.item_id && drag?.id !== it.item_id}
                  onDragStart={() => setDrag({ day: day.day_no, id: it.item_id })}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  onDragOver={() => drag && setOver(it.item_id)}
                  onDrop={() => { drop(day.day_no, places, it.item_id); setDrag(null); setOver(null); }}
                />
                {adding?.day === day.day_no && adding.after === it.item_id && search(day.day_no, it.item_id)}
                {removedAt(day.day_no, it.item_id, true)}
                </Fragment>
              ) : (
                <RouteRow
                  key={it.item_id} item={it} readOnly={readOnly} selected={selectedRoute === it.item_id} change={changeOf(it.item_id)}
                  onSelect={() => onSelectRoute(day.day_no, selectedRoute === it.item_id ? null : it.item_id)}
                  onMode={(mode) => run(() => updateItem(trip.trip_id, it.item_id, { mode }))} // 8
                />
              ),
            )}
            {drag && (
              <div
                className={`day-end-drop ${over === `end-${day.day_no}` ? "on" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOver(`end-${day.day_no}`); }}
                onDrop={(e) => {
                  e.preventDefault();
                  moveTo(day.day_no, places.filter((p) => p.item_id !== drag.id).at(-1)?.item_id ?? null);
                  setDrag(null); setOver(null);
                }}
              >여기에 놓으면 {day.day_no}일차 맨 끝으로</div>
            )}
            {!readOnly && (places.length === 0 && adding?.day === day.day_no ? search(day.day_no, null) : (
              <button className="btn-text add" onClick={() => setAdding({ day: day.day_no, after: places.at(-1)?.item_id ?? null })}>+ 이 날 마지막에 장소 추가</button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function PlaceRow({ item, change, num, readOnly, onMemo, onDelete, onAddAfter, dragging, over, onDragStart, onDragEnd, onDragOver, onDrop }: {
  item: PlaceItem; change?: Change; num: number; readOnly?: boolean;
  onMemo: (m: string) => void; onDelete: () => void; onAddAfter: () => void;
  dragging: boolean; over: boolean;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void;
}) {
  const [memo, setMemo] = useState(item.memo);
  const [editing, setEditing] = useState(false); // 입력 중에는 서버 값으로 덮지 않는다
  // 서버 값이 바뀔 때만 입력란을 맞춘다. (입력란에서 나간 직후 저장 응답 전에 옛 값으로 돌아가지 않게)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!editing) setMemo(item.memo); }, [item.memo]);
  // 손잡이를 누를 때만 카드가 끌리게 한다 (메모 입력칸 글자 선택과 안 겹치게)
  const [armed, setArmed] = useState(false);
  return (
    <div
      className={`item ${dragging ? "dragging" : ""} ${over ? "drop-over" : ""}`}
      draggable={!readOnly && armed}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(item.item_id)); onDragStart(); }}
      onDragEnd={() => { setArmed(false); onDragEnd(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      <span className="time">{item.start_time}</span>
      <span className="num">{num}</span>
      <div className={`place-card ${change ? change.kind : ""}`}>
        {change?.kind === "added" && <div className="change-tag">✦ AI가 추가</div>}
        {change?.kind === "modified" && <div className="change-tag">✦ AI 변경 <s>{change.before}</s> → <b>{change.after}</b></div>}
        {!readOnly && (
          <span className="grip" role="button" aria-label={`${item.place.name} 끌어서 순서 바꾸기`} title="끌어서 순서 바꾸기" onMouseDown={() => setArmed(true)} onMouseUp={() => setArmed(false)}>⋮⋮</span>
        )}
        <div className="row">
          <span className="small muted">{item.place.category}</span>
          <span className="grow" />
          {!readOnly && <>
            <button className="btn-icon" title="이 뒤에 장소 추가" onClick={onAddAfter}>＋</button>
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
            onFocus={() => setEditing(true)}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => { setEditing(false); if (memo !== item.memo) onMemo(memo); }}
          />
        )}
      </div>
    </div>
  );
}

function RouteRow({ item, readOnly, selected, change, onSelect, onMode }: {
  item: RouteItem; readOnly?: boolean; selected: boolean; change?: Change; onSelect: () => void; onMode: (m: TravelMode) => void;
}) {
  const slack = slackMinutes(item);
  return (
    <div className="item">
      <span className="time muted">{item.start_time}</span>
      <span />
      <div
        className={`route ${selected ? "sel" : ""} ${change ? "changed" : ""}`} onClick={onSelect}
        role="button" tabIndex={0} aria-pressed={selected} aria-label={`${item.start_time} 이동 경로 지도에 ${selected ? "숨기기" : "표시"}`}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(); } }}
      >
        {change && <div className="change-tag">✦ AI 변경 <s>{change.before}</s> → <b>{change.after}</b></div>}
        {readOnly ? <span>{MODE_LABEL[item.mode]}</span> : (
          <select value={item.mode} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onMode(e.target.value as TravelMode)}>
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
