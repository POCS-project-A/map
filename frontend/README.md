# 프론트엔드 (React + TypeScript + Vite)

## 실행

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

도커 없이 동작한다.

## 개발 모드와 배포 빌드

| | 개발 모드 (`npm run dev`) | 배포 빌드 (`npm run build`) |
|---|---|---|
| 서버 응답 | 기본은 브라우저 안의 **가짜 서버**. 백엔드에 이미 있는 장소 검색은 진짜 백엔드를 먼저 부르고, 없거나 실패하면 가짜로 넘어간다 | 항상 진짜 백엔드 (`/api`) |
| API 기록 창 (왼쪽 아래) | 보임: 화면에서 오간 요청·응답 JSON 확인용 | 빌드에 들어가지 않음 |

- 개발 모드에서도 모든 요청을 진짜 백엔드로 보내려면 `.env.example`을 `.env`로 복사하고 `VITE_USE_MOCK=false`.
- 개발 모드의 `/api` 요청은 `http://localhost:8000`(FastAPI)으로 넘어간다 (`vite.config.ts`).

## API 연결 구조

- 명세: 노션의 REST API 명세서 (원본)
- 타입: `src/api/types.ts` (명세의 데이터 모양)
- 요청 함수: `src/api/endpoints.ts` (명세의 API, 번호 동일)
- 가짜 서버: `src/api/mock/server.ts` (개발 모드 전용. 명세대로 응답, 새로고침하면 초기화)

## 지도

네이버 지도 JS v3. 클라이언트 ID는 기존 값을 쓰며 `.env`의 `VITE_NAVER_MAP_CLIENT_ID`로 바꿀 수 있다.
인증에 실패하거나 스크립트를 못 불러오면 평면 자리표시 지도로 대신 보여 준다.

## 배포

`Dockerfile`은 Node로 빌드한 정적 파일을 nginx가 서빙한다 (포트 80, 기존 `docker-compose.yml`·CI 그대로).
`/api` 전달 설정은 `docker-compose.yml`이 마운트하는 `nginx/default.conf`를 쓴다.
