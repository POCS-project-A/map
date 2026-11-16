// 브라우저 안에서 도는 가짜 서버. API 명세(노션)대로 응답한다. 백엔드가 생기면 .env에서 끈다.
// 데이터는 메모리에만 있어서 새로고침하면 처음 상태로 돌아간다.
import type {
  Change, Job, Message, Place, PlaceItem, RouteItem, Trip, TripDay, TravelMode, TripSummary,
} from "../types";

type Res = { status: number; body: unknown };
const ok = (body: unknown, status = 200): Res => ({ status, body });
const err = (status: number, detail: string): Res => ({ status, body: { detail } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let nextId = 1000;
const id = () => nextId++;

// ───── 시간, 거리 계산 ─────
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function distanceM(a: Place, b: Place) {
  const dx = (a.lng - b.lng) * 88000, dy = (a.lat - b.lat) * 111000;
  return Math.round(Math.hypot(dx, dy));
}
const SPEED: Record<TravelMode, number> = { car: 350, transit: 250, walk: 70 }; // m/분 (대충)
const FARE: Record<TravelMode, number> = { car: 6000, transit: 1500, walk: 0 };
function travelMinutes(mode: TravelMode, d: number) { return Math.max(5, Math.round(d / SPEED[mode]) + (mode === "transit" ? 10 : 0)); }

// 장소 순서가 바뀌거나 장소가 추가·삭제되면 이동 항목을 다시 만든다 (경로 API 대신 직선 거리로 추정)
function rebuildRoutes(day: TripDay, keepModes = new Map<string, TravelMode>()) {
  const places = day.items.filter((i): i is PlaceItem => i.type === "place");
  const items: (PlaceItem | RouteItem)[] = [];
  places.forEach((p, idx) => {
    items.push(p);
    const next = places[idx + 1];
    if (!next) return;
    const key = pairKey(p, next);
    const old = day.items.find((i): i is RouteItem => i.type === "route" && i.item_id === routeIdFor(day, p, next));
    const mode = keepModes.get(key) ?? old?.mode ?? pairModes.get(key) ?? "car";
    const d = distanceM(p.place, next.place);
    items.push({
      item_id: old?.item_id ?? id(), type: "route", order: 0,
      start_time: p.end_time, end_time: next.start_time,
      mode, travel_minutes: travelMinutes(mode, d), distance_m: d,
      path: [[p.place.lng, p.place.lat], [next.place.lng, next.place.lat]],
      estimated_cost: FARE[mode],
    });
  });
  items.forEach((it, i) => (it.order = i + 1));
  day.items = items;
}
// 순서가 바뀌거나 장소가 추가·삭제되면: 각 장소는 자기 소요 시간을 그대로 들고,
// 그날 첫 시작 시각부터 "장소 → 이동(10분 단위 올림) → 장소" 순서로 시각을 다시 매긴다 (API 명세 7·8·9번)
// 여유 시간 유지: 바뀌기 전 그날의 "이동 칸 길이"(이동 + 여유)를 자리 순서대로 기억했다가 그대로 다시 쓴다.
// 새 이동 시간이 그 칸보다 길면 칸을 늘린다 (여유가 0이 됨).
function retime(day: TripDay, dayStart: number, slots: number[] = []) {
  rebuildRoutes(day);
  let cur = dayStart;
  let k = 0;
  for (const it of day.items) {
    if (it.type === "place") {
      const stay = Math.max(0, toMin(it.end_time) - toMin(it.start_time));
      it.start_time = toTime(cur); it.end_time = toTime(cur + stay); cur += stay;
    } else {
      const need = Math.ceil(it.travel_minutes / 10) * 10;
      const slot = Math.max(need, slots[k++] ?? need);
      it.start_time = toTime(cur); it.end_time = toTime(cur + slot); cur += slot;
    }
  }
}
// 바꾸기 직전 그날 상태를 기억한다: 이동 칸 길이(여유 유지용)와 "장소 쌍 → 이동수단"(이동수단 유지용)
const pairModes = new Map<string, TravelMode>();
const pairKey = (a: PlaceItem, b: PlaceItem) => `${a.place.place_id}>${b.place.place_id}`;
function routeSlots(day: TripDay) {
  day.items.forEach((it, i) => {
    const a = day.items[i - 1], b = day.items[i + 1];
    if (it.type === "route" && a?.type === "place" && b?.type === "place") pairModes.set(pairKey(a, b), it.mode);
  });
  return day.items.filter((i) => i.type === "route").map((r) => toMin(r.end_time) - toMin(r.start_time));
}
const firstStart = (day: TripDay) => {
  const p = day.items.find((i) => i.type === "place");
  return p ? toMin(p.start_time) : 9 * 60;
};

// 같은 두 장소 사이의 기존 이동 항목을 찾기 위한 보조 함수
function routeIdFor(day: TripDay, a: PlaceItem, b: PlaceItem) {
  const ia = day.items.indexOf(a), ib = day.items.indexOf(b);
  if (ia >= 0 && ib === ia + 2 && day.items[ia + 1]?.type === "route") return day.items[ia + 1].item_id;
  return -1;
}

// ───── 초기 데이터 ─────
const P = (name: string, category: string, address: string, lat: number, lng: number): Place =>
  ({ place_id: id(), name, category, address, lat, lng });
const places = {
  gyeongbok: P("경복궁", "관광", "서울 종로구 사직로 161", 37.5796, 126.977),
  gwangjang: P("광장시장", "음식", "서울 종로구 창경궁로 88", 37.5700, 126.9996),
  bukchon: P("북촌한옥마을", "산책", "서울 종로구 계동길 37", 37.5826, 126.9831),
  namsan: P("남산서울타워", "관광", "서울 용산구 남산공원길 105", 37.5512, 126.9882),
  euljiro: P("을지로 노가리골목", "음식", "서울 중구 을지로13길", 37.5660, 126.9910),
  hotel: P("명동 호텔", "숙소", "서울 중구 명동길 14", 37.5637, 126.9830),
  seongsu: P("성수동 카페거리", "카페", "서울 성동구 성수이로", 37.5446, 127.0557),
  forest: P("서울숲", "산책", "서울 성동구 뚝섬로 273", 37.5444, 127.0374),
  lotte: P("롯데월드타워", "쇼핑", "서울 송파구 올림픽로 300", 37.5126, 127.1025),
};
function placeItem(place: Place, start: string, end: string, summary: string, cost: number, memo = ""): PlaceItem {
  return { item_id: id(), type: "place", order: 0, start_time: start, end_time: end, place, summary, estimated_cost: cost, memo };
}
function makeDay(day_no: number, date: string, items: PlaceItem[]): TripDay {
  const day: TripDay = { day_no, date, items };
  rebuildRoutes(day);
  return day;
}

const trips: Trip[] = [
  {
    trip_id: 1, title: "서울 2박 3일 맛집 여행", region: "서울", start_date: "2026-11-20", day_count: 2, share_token: "a8f3k2",
    days: [
      makeDay(1, "2026-11-20", [
        placeItem(places.gyeongbok, "09:00", "11:00", "조선 왕조의 법궁. 한복을 입으면 입장 무료", 3000, "한복 대여 8:30 예약"),
        placeItem(places.gwangjang, "12:30", "14:00", "빈대떡과 육회로 점심", 15000),
        placeItem(places.bukchon, "14:20", "16:30", "한옥 골목 산책, 사진 명소", 0, "주민 거주지라 조용히"),
        placeItem(places.namsan, "17:00", "19:00", "해 질 무렵 전망대", 21000),
        placeItem(places.euljiro, "19:30", "24:30", "야외 호프 골목", 30000),
        placeItem(places.hotel, "25:00", "25:00", "숙소 도착 = 1일차 끝", 120000),
      ]),
      makeDay(2, "2026-11-21", [
        placeItem(places.seongsu, "10:00", "11:30", "브런치와 카페 투어", 12000),
        placeItem(places.forest, "11:50", "13:30", "공원 산책", 0),
        placeItem(places.lotte, "14:00", "18:00", "서울스카이와 쇼핑몰", 31000),
        placeItem(places.hotel, "19:00", "19:00", "숙소", 0),
      ]),
    ],
  },
];
const messages = new Map<number, Message[]>([[1, [
  { message_id: id(), role: "user", text: "서울 2박 3일 맛집 위주로 짜줘", created_at: new Date().toISOString() },
  { message_id: id(), role: "assistant", text: "서울 일정을 만들었어요. 바꾸고 싶은 게 있으면 말해 주세요.", created_at: new Date().toISOString() },
]]]);

// ───── AI 작업 (Celery 흉내: 시간이 지나면 단계가 진행됨) ─────
type JobRec = { job: Job; started: number; finish: () => void; finished: boolean };
const jobs = new Map<number, JobRec>();
function startJob(finish: (job: Job) => void): Job {
  const job: Job = { job_id: id(), status: "queued", step: null, result: null, error: null };
  const rec: JobRec = { job, started: Date.now(), finished: false, finish: () => finish(job) };
  jobs.set(job.job_id, rec);
  setTimeout(() => tickJob(rec), 4100);
  return job;
}
function tickJob(rec: JobRec) {
  const t = Date.now() - rec.started;
  const j = rec.job;
  if (rec.finished) return;
  if (t < 600) { j.status = "queued"; j.step = null; }
  else if (t < 1800) { j.status = "running"; j.step = "searching_places"; }
  else if (t < 3000) { j.status = "running"; j.step = "planning"; }
  else if (t < 4000) { j.status = "running"; j.step = "routing"; }
  else { rec.finished = true; j.status = "done"; j.step = null; rec.finish(); }
}

// ───── AI 작업 중 잠금, 되돌리기 기록 ─────
const busyTrips = new Set<number>(); // AI가 고치는 중인 여행 → 직접 수정은 409
const lastRevision = new Map<number, number | null>(); // 되돌릴 수 있는 마지막 AI 변경
const revisions = new Map<number, { trip_id: number; before: TripDay[]; message: Message }>();

// ───── 도우미 ─────
const findTrip = (tripId: number) => trips.find((t) => t.trip_id === tripId);
function findItem(trip: Trip, itemId: number) {
  for (const day of trip.days) {
    const item = day.items.find((i) => i.item_id === itemId);
    if (item) return { day, item };
  }
  return null;
}
function summary(t: Trip): TripSummary {
  return {
    trip_id: t.trip_id, title: t.title, region: t.region, start_date: t.start_date, day_count: t.day_count,
    place_count: t.days.reduce((n, d) => n + d.items.filter((i) => i.type === "place").length, 0),
  };
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function setMode(route: RouteItem, mode: TravelMode) {
  route.mode = mode;
  route.travel_minutes = travelMinutes(mode, route.distance_m);
  route.estimated_cost = FARE[mode];
}
// 진짜 AI 대신 단순 규칙: 메시지에 수단 단어가 있으면 첫 번째로 다른 수단인 이동을 바로 바꾼다
const MODE_KO: Record<TravelMode, string> = { car: "자동차", transit: "대중교통", walk: "도보" };
function aiReply(trip: Trip, text: string): { text: string; changes?: Change[] } {
  // "OO 빼줘": 그 장소를 지운다 → removed
  const allPlaces = trip.days.flatMap((d) => d.items.filter((i): i is PlaceItem => i.type === "place").map((p) => ({ d, p })));
  const hit = allPlaces.find(({ p }) => text.includes(p.place.name.slice(0, 2)) && !p.place.category.includes("숙소"));
  if (hit && /빼|삭제|지워|없애/.test(text)) {
    const { d, p } = hit;
    const places = d.items.filter((i): i is PlaceItem => i.type === "place");
    const prev = places[places.indexOf(p) - 1];
    const start = firstStart(d), slots = routeSlots(d);
    d.items = places.filter((x) => x !== p);
    retime(d, start, slots);
    return {
      text: `${p.place.name}을(를) 일정에서 뺐어요. 뒤 일정 시각은 다시 계산했어요.`,
      changes: [{ kind: "removed", item_id: p.item_id, summary: p.place.name, before: `${p.start_time}–${p.end_time}`, after: "", day_no: d.day_no, after_item_id: prev?.item_id ?? null }],
    };
  }
  // "추가/넣어줘": 첫째 날 첫 장소 뒤에 창경궁을 넣는다 → added
  if (/추가|넣어/.test(text)) {
    const d = trip.days[0];
    const places = d.items.filter((i): i is PlaceItem => i.type === "place");
    const start = firstStart(d), slots = routeSlots(d);
    const item = placeItem(P("창경궁", "관광", "서울 종로구 창경궁로 185", 37.5788, 126.9950), "00:00", "01:00", "AI가 추천한 근처 고궁", 1000);
    places.splice(1, 0, item);
    d.items = places;
    retime(d, start, slots);
    return {
      text: "근처 창경궁을 경복궁 다음에 넣었어요. 뒤 일정 시각은 다시 계산했어요.",
      changes: [{ kind: "added", item_id: item.item_id, summary: "창경궁", before: "", after: `${item.start_time}–${item.end_time}` }],
    };
  }
  const routes = trip.days.flatMap((d) => d.items).filter((i): i is RouteItem => i.type === "route");
  const want: TravelMode | null = /버스|지하철|대중교통/.test(text) ? "transit" : /걸어|도보/.test(text) ? "walk" : /차|택시|자동차/.test(text) ? "car" : null;
  if (want) {
    const target = routes.find((r) => r.mode !== want);
    if (target) {
      const label = { car: "자동차로", transit: "대중교통으로", walk: "도보로" }[want];
      const before = `${MODE_KO[target.mode]} ${target.travel_minutes}분`;
      setMode(target, want);
      return {
        text: `${target.start_time} 이동을 ${label} 바꿨어요.`,
        changes: [{ kind: "modified", item_id: target.item_id, summary: `${target.start_time} 이동`, before, after: `${MODE_KO[want]} ${target.travel_minutes}분` }],
      };
    }
  }
  return { text: "(가짜 서버) 요청을 받았어요. 실제 AI가 연결되면 일정이 바로 바뀝니다. '버스로 바꿔줘', '북촌 빼줘', '근처 고궁 추가해줘'를 보내 보세요." };
}

// ───── 라우터 ─────
type Handler = (m: RegExpMatchArray, body: any) => Res;
const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/trips$/, () => ok(trips.map(summary))],
  ["POST", /^\/trips$/, (_m, body) => {
    const trip: Trip = {
      trip_id: id(), title: body?.title || (body?.prompt ? `"${String(body.prompt).slice(0, 20)}" 여행` : "새 여행"),
      region: body?.region ?? "", start_date: null, day_count: body?.day_count ?? 1, share_token: Math.random().toString(36).slice(2, 8),
      days: [{ day_no: 1, date: "", items: [] }],
    };
    trips.unshift(trip);
    messages.set(trip.trip_id, []);
    let job_id: number | null = null;
    if (body?.prompt) {
      messages.get(trip.trip_id)!.push({ message_id: id(), role: "user", text: body.prompt, created_at: new Date().toISOString() });
      const job = startJob((j) => {
        // 생성 완료: 샘플 장소 3곳으로 1일차를 채운다
        trip.days[0].items = [
          placeItem(places.gyeongbok, "10:00", "12:00", "AI가 고른 첫 장소", 3000),
          placeItem(places.gwangjang, "12:30", "14:00", "점심", 15000),
          placeItem(places.namsan, "15:00", "17:00", "전망대", 21000),
        ];
        rebuildRoutes(trip.days[0]);
        const msg: Message = { message_id: id(), role: "assistant", text: "(가짜 서버) 일정 초안을 만들었어요.", created_at: new Date().toISOString() };
        messages.get(trip.trip_id)!.push(msg);
        j.result = { message: msg, trip_id: trip.trip_id };
      });
      job_id = job.job_id;
    }
    return ok({ trip_id: trip.trip_id, edit_token: `edit-${trip.trip_id}`, job_id }, 201);
  }],
  ["GET", /^\/trips\/(\d+)$/, (m) => { const t = findTrip(+m[1]); return t ? ok(clone(t)) : err(404, "여행이 없습니다"); }],
  ["PATCH", /^\/trips\/(\d+)$/, (m, body) => {
    const t = findTrip(+m[1]); if (!t) return err(404, "여행이 없습니다");
    if (body?.title !== undefined) t.title = body.title;
    if (body?.start_date !== undefined) t.start_date = body.start_date;
    return ok(clone(t));
  }],
  ["DELETE", /^\/trips\/(\d+)$/, (m) => {
    const i = trips.findIndex((t) => t.trip_id === +m[1]); if (i < 0) return err(404, "여행이 없습니다");
    trips.splice(i, 1); return ok(null, 204);
  }],
  ["POST", /^\/trips\/(\d+)\/claim$/, (m) => { const t = findTrip(+m[1]); return t ? ok(clone(t)) : err(404, "여행이 없습니다"); }],
  ["POST", /^\/trips\/(\d+)\/items$/, (m, body) => {
    const t = findTrip(+m[1]); if (!t) return err(404, "여행이 없습니다");
    const day = t.days.find((d) => d.day_no === body?.day_no); if (!day) return err(400, "일차가 없습니다");
    const stay = Number(body?.stay_minutes) || 60;
    const start = firstStart(day), slots = routeSlots(day);
    const item = placeItem({ place_id: id(), ...body.place }, "00:00", toTime(stay), "", 0);
    const places = day.items.filter((i): i is PlaceItem => i.type === "place");
    if (body?.after_item_id == null) places.unshift(item);
    else {
      const at = places.findIndex((p) => p.item_id === body.after_item_id);
      if (at < 0) return err(400, "after_item_id가 그날 장소가 아닙니다");
      places.splice(at + 1, 0, item);
    }
    day.items = places;
    retime(day, start, slots);
    return ok(clone(t), 201);
  }],
  ["PATCH", /^\/trips\/(\d+)\/items\/(\d+)$/, (m, body) => {
    const t = findTrip(+m[1]); if (!t) return err(404, "여행이 없습니다");
    const found = findItem(t, +m[2]); if (!found) return err(404, "항목이 없습니다");
    const it = found.item;
    const moving = it.type === "place" && (body?.day_no !== undefined || body?.after_item_id !== undefined);
    const to = moving ? t.days.find((d) => d.day_no === (body.day_no ?? found.day.day_no)) : undefined;
    const after: number | null = moving ? (body.after_item_id ?? null) : null;
    if (moving) {
      if (!to) return err(400, "그 일차가 없습니다");
      if (after !== null && !to.items.some((i) => i.type === "place" && i.item_id === after && i !== it)) {
        return err(400, "after_item_id가 그 날 장소가 아닙니다");
      }
    }
    if (body?.start_time) it.start_time = body.start_time;
    if (body?.end_time) it.end_time = body.end_time;
    if (it.type === "place" && body?.memo !== undefined) it.memo = body.memo;
    if (it.type === "route" && body?.mode) setMode(it, body.mode);
    // 위치 옮기기: day_no 또는 after_item_id가 오면 그 날, 그 장소 뒤로 옮긴다 (null이면 맨 앞)
    if (moving && to && it.type === "place") {
      const from = found.day;
      const fromStart = firstStart(from), fromSlots = routeSlots(from);
      const toStart = firstStart(to), toSlots = routeSlots(to);
      from.items = from.items.filter((i) => i.type === "place" && i !== it);
      const target = to.items.filter((i): i is PlaceItem => i.type === "place" && i !== it);
      const at = after === null ? 0 : target.findIndex((p) => p.item_id === after) + 1;
      target.splice(at, 0, it);
      to.items = target;
      if (from !== to) retime(from, fromStart, fromSlots);
      retime(to, from === to ? fromStart : toStart, from === to ? fromSlots : toSlots);
    } else if (it.type === "place") rebuildRoutes(found.day);
    return ok(clone(t));
  }],
  ["DELETE", /^\/trips\/(\d+)\/items\/(\d+)$/, (m) => {
    const t = findTrip(+m[1]); if (!t) return err(404, "여행이 없습니다");
    const found = findItem(t, +m[2]); if (!found) return err(404, "항목이 없습니다");
    if (found.item.type === "route") return err(400, "이동 항목은 직접 지울 수 없습니다. 장소를 지우면 다시 계산됩니다");
    const start = firstStart(found.day), slots = routeSlots(found.day);
    found.day.items = found.day.items.filter((i) => i !== found.item);
    retime(found.day, start, slots);
    return ok(clone(t));
  }],
  ["GET", /^\/places\/search\?keyword=(.*)$/, (m) => {
    const kw = decodeURIComponent(m[1]).trim();
    if (!kw) return err(400, "검색어를 입력해 주세요");
    const pool = [
      P("창경궁", "관광", "서울 종로구 창경궁로 185", 37.5788, 126.9950), P("익선동 한옥거리", "카페", "서울 종로구 익선동", 37.5741, 126.9897),
      P("광화문광장", "관광", "서울 종로구 세종대로 172", 37.5725, 126.9769), P("망원시장", "음식", "서울 마포구 포은로8길 14", 37.5560, 126.9060),
      P("홍대 걷고싶은거리", "산책", "서울 마포구 어울마당로", 37.5536, 126.9220),
    ];
    const found = pool.filter((p) => p.name.includes(kw) || p.category.includes(kw) || p.address.includes(kw));
    const result = (found.length ? found : pool.slice(0, 3)).map(({ place_id: _id, ...rest }) => rest);
    return ok({ places: result });
  }],
  ["GET", /^\/trips\/(\d+)\/messages$/, (m) => ok(messages.get(+m[1]) ?? [])],
  ["POST", /^\/trips\/(\d+)\/messages$/, (m, body) => {
    const t = findTrip(+m[1]); if (!t) return err(404, "여행이 없습니다");
    const text = String(body?.text ?? "").trim(); if (!text) return err(400, "내용을 입력해 주세요");
    if (busyTrips.has(t.trip_id)) return err(409, "AI가 이미 일정을 바꾸는 중이에요");
    const list = messages.get(t.trip_id) ?? []; messages.set(t.trip_id, list);
    list.push({ message_id: id(), role: "user", text, created_at: new Date().toISOString() });
    busyTrips.add(t.trip_id);
    const job = startJob((j) => {
      const before = clone(t.days);
      const reply = aiReply(t, text);
      const msg: Message = { message_id: id(), role: "assistant", text: reply.text, created_at: new Date().toISOString() };
      if (reply.changes) {
        msg.changes = reply.changes;
        msg.revision_id = id();
        revisions.set(msg.revision_id, { trip_id: t.trip_id, before, message: msg });
        lastRevision.set(t.trip_id, msg.revision_id);
      }
      list.push(msg);
      busyTrips.delete(t.trip_id);
      j.result = { message: msg, trip_id: t.trip_id };
    });
    return ok({ job_id: job.job_id }, 202);
  }],
  ["GET", /^\/jobs\/(\d+)$/, (m) => {
    const rec = jobs.get(+m[1]); if (!rec) return err(404, "작업이 없습니다");
    tickJob(rec); return ok(clone(rec.job));
  }],
  ["POST", /^\/trips\/(\d+)\/revisions\/(\d+)\/revert$/, (m) => {
    const t = findTrip(+m[1]); if (!t) return err(404, "여행이 없습니다");
    const rev = revisions.get(+m[2]); if (!rev || rev.trip_id !== t.trip_id) return err(404, "변경 기록이 없습니다");
    if (rev.message.reverted) return err(409, "이미 되돌린 변경입니다");
    if (lastRevision.get(t.trip_id) !== +m[2]) return err(409, "그 뒤에 일정이 또 바뀌어서 되돌릴 수 없어요");
    t.days = clone(rev.before);
    rev.message.reverted = true;
    lastRevision.set(t.trip_id, null);
    return ok(clone(t));
  }],
  ["GET", /^\/shared\/(\w+)$/, (m) => { const t = trips.find((x) => x.share_token === m[1]); return t ? ok(clone(t)) : err(404, "공유 링크가 없습니다"); }],
];

export async function handleMock(method: string, path: string, body?: unknown): Promise<Res> {
  await sleep(150 + Math.random() * 150); // 네트워크 지연 흉내
  for (const [mth, re, h] of routes) {
    if (mth !== method) continue;
    const m = path.match(re);
    if (m) {
      // 일정을 직접 바꾸는 요청: AI 작업 중이면 409, 성공하면 그 전 AI 변경은 더 이상 되돌릴 수 없다
      const edit = method !== "GET" && path.match(/^\/trips\/(\d+)(\/items|\/days|$)/);
      if (edit && busyTrips.has(+edit[1])) {
        return err(409, "AI가 일정을 바꾸는 중이에요. 끝난 뒤 다시 시도해 주세요");
      }
      const res = h(m, body);
      if (edit && res.status < 300) lastRevision.set(+edit[1], null);
      console.debug(`[mock] ${method} /api${path} → ${res.status}`, body ?? "", res.body);
      return res;
    }
  }
  return err(404, `가짜 서버에 없는 API: ${method} ${path}`);
}
