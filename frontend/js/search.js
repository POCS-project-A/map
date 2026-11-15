
const searchInput = document.querySelector(".search-input");
const searchButton = document.querySelector(".search-button");
const searchResult = document.getElementById("search-result");
let latestSearchId = 0;

// 검색 버튼을 눌렀을 때 실행되는 함수
async function searchPlaces() {
    const searchId = ++latestSearchId;
    const keyword = searchInput.value.trim();

    if (!keyword) {
        searchResult.textContent = "검색어를 입력해주세요.";
        return;
    }

    searchResult.textContent = "검색 중입니다...";

    try {
        const response = await fetch(
            `/api/places/search?keyword=${encodeURIComponent(keyword)}`
        );

        const data = await response.json();

        if (searchId !== latestSearchId) return;

        if (!response.ok) {
            throw new Error(
                typeof data.detail === "string"
                    ? data.detail
                    : "검색 요청에 실패했습니다."
            );
        }

        searchResult.replaceChildren();

        if (data.places.length === 0) {
            searchResult.textContent = "검색 결과가 없습니다.";
            return;
        }

        const list = document.createElement("ul");

        for (const place of data.places) {
            const item = document.createElement("li");
            const name = document.createElement("strong");
            const address = document.createElement("p");
            const category = document.createElement("p");

            name.textContent = place.name;
            address.textContent = place.address;
            category.textContent = place.category;

            item.append(name, address, category);
            list.append(item);
        }

        searchResult.append(list);

    } catch (error) {
        if (searchId !== latestSearchId) return;

        searchResult.textContent =
            error instanceof Error
                ? error.message
                : "검색 중 오류가 발생했습니다.";
    }
}

// 검색 버튼 클릭 이벤트
searchButton.addEventListener("click", searchPlaces);

// Enter 키로도 검색 가능
searchInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
        searchPlaces();
    }
});
