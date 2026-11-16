import { useEffect, useState } from "react";
import { createTrip, deleteTrip, listTrips } from "../api/endpoints";
import type { TripSummary } from "../api/types";
import ErrorBox from "../components/ErrorBox";
import { go } from "../lib/nav";

export default function LibraryPage() {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<{ title: string; error: unknown } | null>(null);

  async function load() {
    setLoadError(null);
    try { setTrips(await listTrips()); } catch (e) { setLoadError(e); } // 1
  }
  useEffect(() => { load(); }, []);

  async function create(withPrompt: boolean) {
    setActionError(null);
    try {
      const res = await createTrip(withPrompt ? { prompt } : { title: "새 여행" }); // 2
      localStorage.setItem(`edit_token:${res.trip_id}`, res.edit_token);
      go(`/trips/${res.trip_id}${res.job_id ? `?job=${res.job_id}` : ""}`);
    } catch (e) { setActionError({ title: "여행을 만들지 못했어요", error: e }); }
  }

  async function remove(t: TripSummary) {
    if (!confirm(`"${t.title}"을 삭제할까요?`)) return;
    setActionError(null);
    try {
      await deleteTrip(t.trip_id); // 5
      load();
    } catch (e) { setActionError({ title: `"${t.title}"을 삭제하지 못했어요`, error: e }); }
  }

  return (
    <div className="library">
      <header className="topbar">
        <b className="wordmark">✦ 앱 이름 미정</b>
        <span className="grow" />
      </header>
      <main className="library-body">
        <section className="hero">
          <h1>어디로 떠나볼까요?</h1>
          <p>AI에게 말하면 일정을 짜 드려요</p>
          <form className="hero-input" onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) create(true); }}>
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="예: 서울 2박 3일 맛집 위주로" />
            <button className="btn-primary" disabled={!prompt.trim()}>AI로 만들기</button>
          </form>
        </section>

        <div className="row" style={{ margin: "24px 0 10px" }}>
          <h2 className="grow">내 여행</h2>
          <button className="btn" onClick={() => create(false)}>+ 빈 여행</button>
        </div>
        {actionError && <ErrorBox title={actionError.title} error={actionError.error} />}
        {loadError ? (
          <ErrorBox title="여행 목록을 불러오지 못했어요" error={loadError} onRetry={load} />
        ) : (
          <>
            {!trips && <p className="muted">불러오는 중…</p>}
            {trips?.length === 0 && <p className="muted">아직 여행이 없어요.</p>}
            <div className="trip-grid">
              {trips?.map((t) => (
                <div key={t.trip_id} className="trip-card">
                  {/* 키보드(Tab, Enter)로도 열 수 있게 링크로 둔다 */}
                  <a className="trip-link" href={`#/trips/${t.trip_id}`}>
                    <b>{t.title}</b>
                    <span className="muted small">{t.start_date ?? "날짜 미정"} · {t.day_count}일 · 장소 {t.place_count}곳</span>
                  </a>
                  <button className="btn-text" onClick={() => remove(t)}>삭제</button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
