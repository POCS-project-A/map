const mapTab = document.getElementById("map-tab");
const searchTab = document.getElementById("search-tab");
const mapPanel = document.getElementById("map-panel");
const searchPanel = document.getElementById("search-panel");

mapTab.addEventListener("click", () => {
    mapPanel.hidden = false;
    searchPanel.hidden = true;

    mapTab.setAttribute("aria-pressed", "true");
    searchTab.setAttribute("aria-pressed", "false");

    // 다시 표시된 지도 영역에 맞춰 크기와 중심을 유지
    if (window.travelMap) {
        const center = window.travelMap.getCenter();

        window.travelMap.setSize(
            new naver.maps.Size(
                document.getElementById("map").clientWidth,
                document.getElementById("map").clientHeight
            )
        );
        window.travelMap.setCenter(center);
    }
});

searchTab.addEventListener("click", () => {
    mapPanel.hidden = true;
    searchPanel.hidden = false;

    mapTab.setAttribute("aria-pressed", "false");
    searchTab.setAttribute("aria-pressed", "true");

    document.querySelector(".search-input").focus();
});