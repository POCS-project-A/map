// docs/api.md 2장 "데이터 모양"과 1:1로 맞춘 타입. 명세가 바뀌면 여기부터 고친다.

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

export interface Message {
  message_id: number;
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export interface Change {
  item_id: number;
  field: string;
  before: unknown;
  after: unknown;
}

export interface Suggestion {
  suggestion_id: number;
  title: string;
  changes: Change[];
  status: "pending" | "applied" | "dismissed";
}

export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobStep = "searching_places" | "planning" | "routing" | null;

export interface Job {
  job_id: number;
  status: JobStatus;
  step: JobStep;
  result: { message?: Message; suggestion?: Suggestion | null; trip_id?: number } | null;
  error: string | null;
}

// 요청 본문
export interface CreateTripBody { title?: string; region?: string; day_count?: number; prompt?: string }
export interface CreateTripResponse { trip_id: number; edit_token: string; job_id: number | null }
export interface UpdateTripBody { title?: string; start_date?: string }
export interface AddItemBody { day_no: number; place: Omit<Place, "place_id">; after_item_id?: number }
export interface UpdateItemBody { start_time?: string; end_time?: string; memo?: string; mode?: TravelMode }
export interface AcceptedJob { job_id: number }
