import os
import re
from html import unescape

import httpx
from fastapi import FastAPI, HTTPException, Query

app = FastAPI()


@app.get("/")
def home():
    return {"message": "FastAPI 서버 실행 성공!"}


@app.get("/api/places/search")
async def search_places(
    keyword: str = Query(min_length=1, max_length=100),
):
    keyword = keyword.strip()

    if not keyword:
        raise HTTPException(400, "검색어를 입력해주세요.")

    client_id = os.getenv("NAVER_SEARCH_CLIENT_ID")
    client_secret = os.getenv("NAVER_SEARCH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(503, "검색 API 인증 정보가 설정되지 않았습니다.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://naverapihub.apigw.ntruss.com/search/v1/local",
                headers={
                    "X-NCP-APIGW-API-KEY-ID": client_id,
                    "X-NCP-APIGW-API-KEY": client_secret,
                },
                params={
                    "query": keyword,
                    "display": 5,
                    "format": "json",
                },
            )

        response.raise_for_status()

    except httpx.TimeoutException:
        raise HTTPException(504, "검색 서버 응답 시간이 초과되었습니다.")
    except httpx.HTTPStatusError as error:
        status = error.response.status_code

        if status in (401, 403):
            message = "검색 API 인증 정보와 지역 API 사용 권한을 확인해주세요."
        elif status == 429:
            message = "검색 API 호출 한도를 초과했습니다."
        else:
            message = "외부 검색 서버에서 오류가 발생했습니다."

        raise HTTPException(502, message)
    except httpx.RequestError:
        raise HTTPException(502, "검색 서버에 연결하지 못했습니다.")

    try:
        items = response.json()["items"]

        if not isinstance(items, list):
            raise ValueError("잘못된 장소 목록")

        places = [
            {
                "name": unescape(re.sub(r"<[^>]*>", "", item["title"])),
                "address": item.get("roadAddress") or item.get("address", ""),
                "category": item.get("category", ""),
            }
            for item in items
        ]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(502, "검색 서버의 응답 형식이 올바르지 않습니다.")

    return {"keyword": keyword, "places": places}