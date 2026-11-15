import { useEffect, useState } from "react";
import { getJob } from "../api/endpoints";
import type { Job } from "../api/types";

// AI 작업이 끝날 때까지 1초마다 GET /api/jobs/{job_id} (명세서 14번)
export function useJob(jobId: number | null, onDone: (job: Job) => void) {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    if (jobId == null) { setJob(null); return; }
    let stop = false;
    const tick = async () => {
      try {
        const j = await getJob(jobId);
        if (stop) return;
        setJob(j);
        if (j.status === "done" || j.status === "failed") { onDone(j); return; }
      } catch { /* 네트워크 오류면 다음 틱에 다시 */ }
      if (!stop) setTimeout(tick, 1000);
    };
    tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  return job;
}

export const STEP_LABEL: Record<string, string> = {
  searching_places: "장소 찾는 중",
  planning: "일정 짜는 중",
  routing: "경로 계산 중",
};
