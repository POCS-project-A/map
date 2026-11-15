# REST API 명세서 (초안)

> 상태: 초안. "결정 필요" 칸이 비어 있지 않은 항목은 팀 확인이 필요하다.
> 규칙: 모든 주소는 `/api/`로 시작, 리소스 이름은 복수 명사, JSON 필드는 snake_case.
> 인증: 로그인한 요청은 `Authorization: Bearer <토큰>`. 비로그인으로 만든 여행은 `X-Edit-Token: <edit_token>` 헤더로 수정한다. 로그인 방식(소셜/이메일)은 미정.

## 1. 엔드포인트 한눈에 보기

주소 앞의 `/api`는 생략했다. `{trip}`은 여행 번호, `{item}`은 일정 항목 번호.

### 여행

| # | API | 하는 일 | 화면 |
|---|---|---|---|
| 1 | `GET /trips` | 내 여행 목록 | 라이브러리 |
| 2 | `POST /trips` | 새 여행 만들기 (`prompt`를 주면 AI 생성 시작) | + 새 여행 |
| 3 | `GET /trips/{trip}` | 여행 상세 (일차 → 항목) | 일정 상세 |
| 4 | `PATCH /trips/{trip}` | 제목·날짜·인원·예산 수정 | 일정 상단 |
| 5 | `DELETE /trips/{trip}` | 여행 삭제 | 라이브러리 |
| 6 | `POST /trips/{trip}/claim` | 비로그인 여행을 내 계정에 저장 | 로그인 창 |

### 일정 항목 (장소, 이동)

| # | API | 하는 일 | 화면 |
|---|---|---|---|
| 7 | `POST /trips/{trip}/items` | 장소 추가 | + 장소 추가 |
| 8 | `PATCH /trips/{trip}/items/{item}` | 시간·메모·이동수단 수정 | 일정 카드 |
| 9 | `DELETE /trips/{trip}/items/{item}` | 항목 삭제 | 카드 ⋯ 메뉴 |
| 10 | `PUT /trips/{trip}/days/{day}/order` | 하루 장소 순서 바꾸기 | 드래그 |

### 장소 검색

| # | API | 하는 일 | 화면 |
|---|---|---|---|
| 11 | `GET /places/search?keyword=` | 장소 검색 | 장소 추가 창 |

### AI

| # | API | 하는 일 | 화면 |
|---|---|---|---|
| 12 | `GET /trips/{trip}/messages` | 대화 기록 | 오른쪽 AI |
| 13 | `POST /trips/{trip}/messages` | AI에게 말하기 → 작업 번호 받음 | AI 입력창 |
| 14 | `GET /jobs/{job}` | AI 작업 진행 확인 (1~2초마다) | 대기 표시 |
| 15 | `GET /trips/{trip}/suggestions` | AI 제안 목록 | AI 탭 |
| 16 | `POST /suggestions/{id}/apply` | 제안 적용 (즉시) | 적용 버튼 |
| 17 | `POST /suggestions/{id}/dismiss` | 제안 무시 | 무시 버튼 |

### 공유

| # | API | 하는 일 | 화면 |
|---|---|---|---|
| 18 | `GET /shared/{token}` | 공유 링크로 읽기 전용 조회 | 공유 화면 |

비용 화면은 별도 API 없이 항목의 `estimated_cost`를 프론트가 합산한다.

### 결정 필요

- 4번: 인원·예산 컬럼이 ERD에 없음
- 6번: 로그인 방식(소셜/이메일) 미정
- 10번: 다른 날로 옮기기도 이 API로 할지
- 11번: 이미 구현됨(`feature/map-update`, 네이버). 새 그림은 구글 지도라 업체 확정 필요
- 12, 15번: ERD에 대화·제안 테이블 없음 (3장 참고)
- 16, 17번: 주소를 `/trips/{trip}/suggestions/{id}/...`로 길게 쓸지, 지금처럼 짧게 쓸지

## 2. 데이터 모양

### 여행 상세 (`GET /api/trips/{trip_id}` 응답)

```json
{
  "trip_id": 12,
  "title": "서울 2박 3일 맛집 여행",
  "region": "서울",
  "start_date": "2026-11-20",
  "day_count": 3,
  "share_token": "a8f3k2",
  "days": [
    {
      "day_no": 1,
      "date": "2026-11-20",
      "items": [
        {
          "item_id": 101, "type": "place", "order": 1,
          "start_time": "09:00", "end_time": "11:00",
          "place": { "place_id": 7, "name": "경복궁", "category": "관광", "address": "서울 종로구 사직로 161", "lat": 37.5796, "lng": 126.9770 },
          "summary": "조선 왕조의 법궁", "estimated_cost": 3000, "memo": "한복 대여 8:30 예약"
        },
        {
          "item_id": 102, "type": "route", "order": 2,
          "start_time": "11:00", "end_time": "12:30",
          "mode": "transit", "travel_minutes": 60, "distance_m": 4200,
          "path": [[126.9770, 37.5796], [126.9996, 37.5700]],
          "estimated_cost": 1500
        }
      ]
    }
  ]
}
```

- `type: "route"` 항목의 여유 시간 = (`end_time` − `start_time`) − `travel_minutes`. 프론트가 계산한다.
- `mode`: `car` / `transit` / `walk`. 지원 범위는 경로 API 확인 후 확정.
- 자정 넘김은 `"25:00"`처럼 24 이상 시간으로 표현한다 (숙소 도착 = 하루 끝).

### AI 작업 (`GET /api/jobs/{job_id}` 응답)

```json
{
  "job_id": 55,
  "status": "running",
  "step": "searching_places",
  "result": null,
  "error": null
}
```

- `status`: `queued` → `running` → `done` / `failed`
- `step`: `searching_places` → `planning` → `routing` (화면에 진행 단계 표시용)
- `done`이면 `result`에 AI 답변과 만들어진 제안이 들어 있다:

```json
{
  "message": { "message_id": 9, "role": "assistant", "text": "11:00 이동을 버스로 바꾸는 안이에요." },
  "suggestion": {
    "suggestion_id": 3,
    "changes": [
      { "item_id": 102, "field": "mode", "before": "car", "after": "transit" }
    ]
  }
}
```

## 3. ERD와 맞지 않는 부분 (확인 필요)

| 화면에 필요한 것 | 현재 ERD | 제안 |
|---|---|---|
| AI 대화 기록 | 없음 | `대화_메시지` 테이블 (여행_아이디, 역할, 내용, 생성_일시) |
| AI 제안 | 없음 | `AI_제안` 테이블 (여행_아이디, 변경내용 JSON, 상태: 대기/적용/무시) |
| 구간마다 다른 이동수단 | `여행.이동수단` (여행 하나에 하나) | `여행_장소`에 `다음_장소_이동수단` 추가 |
| 이동에 배정한 시간 | 이동시간만 있음 | 다음 장소의 `방문_시각`으로 계산 가능 (추가 컬럼 불필요) |
| 예상 비용, 메모 | 없음 | `여행_장소`에 `예상_비용`, `메모` 추가 |
| 인원, 예산 | 없음 | `여행`에 `인원`, `예산` 추가 (MVP에 필요할 때) |
| DB 종류 | 타입이 PostgreSQL식 (SERIAL, JSONB) | 새 아키텍처 그림은 MySQL. 어느 쪽인지 확정 필요 |
