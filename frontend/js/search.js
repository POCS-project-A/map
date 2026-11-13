
const searchInput = document.querySelector(".search-input");
const searchButton = document.querySelector(".search-button");
const searchResult = document.getElementById("search-result");

// 검색 버튼을 눌렀을 때 실행되는 함수
async function searchPlaces() {
    const keyword = searchInput.value.trim();

    if (keyword === "") {
        searchResult.textContent = "검색어를 입력해주세요.";
        return;
    }

    searchResult.textContent = "검색 중입니다...";

    try {
        // Nginx를 통해 FastAPI 서버에 GET 요청
        const response = await fetch(
            `/api/places/search?keyword=${encodeURIComponent(keyword)}`
        );

        if (!response.ok) {
            throw new Error("서버 요청 실패");
        }

        // FastAPI가 반환한 JSON 데이터를 객체로 변환
        const data = await response.json();

        console.log("FastAPI 응답:", data);

        // 응답 결과를 HTML 화면에 출력
        searchResult.textContent =
            `${data.message}\n검색어: ${data.keyword}`;

        searchResult.style.whiteSpace = "pre-line";

    } catch (error) {
        console.error("오류:", error);
        searchResult.textContent =
            "서버 연결 중 오류가 발생했습니다.";
    }
}

// 검색 버튼 클릭 이벤트
searchButton.addEventListener("click", searchPlaces);

// Enter 키로도 검색 가능
searchInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchPlaces();
    }
});
