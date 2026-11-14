const mapElement = document.getElementById("map");

if (window.naver && window.naver.maps) {
    const position = new naver.maps.LatLng(37.5665, 126.9780);

    const map = new naver.maps.Map(mapElement, {
        center: position,
        zoom: 14
    });

window.travelMap = map;

    new naver.maps.Marker({
        position: position,
        map: map
    });
} else {
    mapElement.textContent =
        "지도를 불러오지 못했습니다. Maps 인증 설정을 확인해주세요.";
}