// API 명세(노션)의 API 15개. 번호는 명세서 번호와 같다.
import { request } from "./client";
import type {
  AcceptedJob, AddItemBody, CreateTripBody, CreateTripResponse, Job, Message, Place,
  Trip, TripItem, TripSummary, UpdateItemBody, UpdateTripBody,
} from "./types";

// 여행
export const listTrips = () => request<TripSummary[]>("GET", "/trips"); // 1
export const createTrip = (body: CreateTripBody) => request<CreateTripResponse>("POST", "/trips", body); // 2
export const getTrip = (tripId: number) => request<Trip>("GET", `/trips/${tripId}`); // 3
export const updateTrip = (tripId: number, body: UpdateTripBody) => request<Trip>("PATCH", `/trips/${tripId}`, body); // 4
export const deleteTrip = (tripId: number) => request<null>("DELETE", `/trips/${tripId}`); // 5
export const claimTrip = (tripId: number) => request<Trip>("POST", `/trips/${tripId}/claim`); // 6

// 일정 항목
export const addItem = (tripId: number, body: AddItemBody) => request<Trip>("POST", `/trips/${tripId}/items`, body); // 7
export const updateItem = (tripId: number, itemId: number, body: UpdateItemBody) =>
  request<Trip>("PATCH", `/trips/${tripId}/items/${itemId}`, body); // 8
export const deleteItem = (tripId: number, itemId: number) => request<Trip>("DELETE", `/trips/${tripId}/items/${itemId}`); // 9

// 장소 검색
export const searchPlaces = (keyword: string) =>
  request<{ places: Omit<Place, "place_id">[] }>("GET", `/places/search?keyword=${encodeURIComponent(keyword)}`); // 10

// AI
export const listMessages = (tripId: number) => request<Message[]>("GET", `/trips/${tripId}/messages`); // 11
export const sendMessage = (tripId: number, text: string) => request<AcceptedJob>("POST", `/trips/${tripId}/messages`, { text }); // 12
export const getJob = (jobId: number) => request<Job>("GET", `/jobs/${jobId}`); // 13
export const revertRevision = (tripId: number, revisionId: number) =>
  request<Trip>("POST", `/trips/${tripId}/revisions/${revisionId}/revert`); // 14

// 공유
export const getShared = (token: string) => request<Trip>("GET", `/shared/${token}`); // 15

export type { TripItem };
