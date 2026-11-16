import { useEffect, useState } from "react";
import LibraryPage from "./pages/LibraryPage";
import TripPage from "./pages/TripPage";
import SharedPage from "./pages/SharedPage";
import ApiLog from "./components/ApiLog";

// 라우터 라이브러리 없이 주소의 # 뒤를 보고 화면을 고른다.
// #/                  라이브러리
// #/trips/12?job=55   일정 상세 (job이 있으면 AI 생성 진행 중)
// #/shared/a8f3k2     공유 화면
function useHash() {
  const [hash, setHash] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || "/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query);
  let page = <LibraryPage />;
  const trip = path.match(/^\/trips\/(\d+)$/);
  const shared = path.match(/^\/shared\/(\w+)$/);
  if (trip) page = <TripPage key={trip[1]} tripId={+trip[1]} jobId={params.get("job") ? +params.get("job")! : null} />;
  if (shared) page = <SharedPage token={shared[1]} />;
  return (
    <>
      {page}
      {import.meta.env.DEV && <ApiLog />}
    </>
  );
}
