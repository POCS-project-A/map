from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "FastAPI 서버 실행 성공!"}

@app.get("/api/places/search")
def search_places(keyword: str):
    print(f"검색 요청 도착: {keyword}", flush=True)

    return {
        "message": "FastAPI 요청 처리 성공!",
        "keyword": keyword
    }