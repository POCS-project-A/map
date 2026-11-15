# 프론트엔드 (React + TypeScript + Vite)

## 실행

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

도커 없이 동작한다. 기본은 **가짜 서버 모드**라서 백엔드 없이도 모든 화면이 돈다.

## API 연결 구조

- 명세: `docs/api.md`
- 타입: `src/api/types.ts` (명세의 데이터 모양)
- 요청 함수: `src/api/endpoints.ts` (명세의 API 18개, 번호 동일)
- 가짜 서버: `src/api/mock/server.ts` (명세대로 응답, 새로고침하면 초기화)
- 화면 왼쪽 아래 **API 기록** 창에서 실제로 오간 요청·응답 JSON을 볼 수 있다.

백엔드가 준비되면 `.env.example`을 `.env`로 복사하고 `VITE_USE_MOCK=false`로 바꾼다.
그러면 `/api` 요청이 `http://localhost:8000`(FastAPI)으로 넘어간다 (`vite.config.ts`).

## 배포

`Dockerfile`은 Node로 빌드한 정적 파일을 nginx가 서빙한다 (포트 80, 기존 CI 그대로).
