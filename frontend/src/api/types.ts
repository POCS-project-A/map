// API 명세(노션)의 "데이터 모양"과 1:1로 맞춘 타입. 명세가 바뀌면 여기부터 고친다.

export type TravelMode = "car" | "transit" | "walk";

export interface Place {
  place_id: number;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PlaceItem {
  item_id: number;
  type: "place";
  order: number;
  start_time: string; // "HH:MM", 자정 넘김은 "25:00"
  end_time: string;
  place: Place;
  summary: string;
  estimated_cost: number;
  memo: string;
}

export interface RouteItem {
  item_id: number;
  type: "route";
  order: number;
  start_time: string;
  end_time: string;
  mode: TravelMode;
  travel_minutes: number;
  distance_m: number;
  path: [number, number][]; // [lng, lat]
  estimated_cost: number;
}

export type TripItem = PlaceItem | RouteItem;

export interface TripDay {
  day_no: number;
  date: string;
  items: TripItem[];
}

export interface TripSummary {
  trip_id: number;
  title: string;
  region: string;
  start_date: string | null;
  day_count: number;
  place_count: number;
}

export interface Trip {
  trip_id: number;
  title: string;
  region: string;
  start_date: string | null;
  day_count: number;
  share_token: string;
  days: TripDay[];
}

// AI가 바꾼 것 하나. kind로 화면 색을 정한다: added 초록, modified 파랑, removed 빨강
export interface Change {
  kind: "added" | "modified" | "removed";
  item_id: number;  // removed면 이미 없어진 항목 번호
  summary: string;  // 예: "11:00 이동", "북촌한옥마을"
  before: string;   // 예: "자동차 25분" (added면 "")
  after: string;    // 예: "대중교통 60분" (removed면 "")
  // removed일 때만: 빠진 장소를 원래 자리에 흐리게 보여 주기 위한 위치
  day_no?: number;
  after_item_id?: number | null;
}

export interface Message {
  message_id: number;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  // AI가 일정을 바꾼 답변에만 있다. revision_id로 되돌릴 수 있다 (14번)
  changes?: Change[];
  revision_id?: number;
  reverted?: boolean;
}

export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobStep = "searching_places" | "planning" | "routing" | null;

export interface Job {
  job_id: number;
  status: JobStatus;
  step: JobStep;
  result: { message?: Message; trip_id?: number } | null; // done이면 일정은 이미 바뀌어 있다
  error: string | null;
}

// 요청 본문
export interface CreateTripBody { title?: string; region?: string; day_count?: number; prompt?: string }
export interface CreateTripResponse { trip_id: number; edit_token: string; job_id: number | null }
export interface UpdateTripBody { title?: string; start_date?: string }
// after_item_id: 이 장소 뒤에 넣는다 (null이면 그날 맨 앞). 시작 시각은 서버가 계산한다
export interface AddItemBody { day_no: number; after_item_id: number | null; place: Omit<Place, "place_id">; stay_minutes: number }
// day_no / after_item_id를 보내면 그 날, 그 장소 뒤로 옮긴다 (after_item_id = null이면 그 날 맨 앞)
export interface UpdateItemBody { start_time?: string; end_time?: string; memo?: string; mode?: TravelMode; day_no?: number; after_item_id?: number | null }
export interface AcceptedJob { job_id: number }
