import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// 데스크톱(1440px) 기준 화면. 창이 더 좁으면 통째로 축소해서 세 영역이 모두 보이게 한다.
function fit() {
  const root = document.getElementById("root")!;
  const z = Math.min(1, innerWidth / 1440);
  document.body.style.zoom = String(z);
  root.style.width = z < 1 ? "1440px" : "";
  root.style.height = z < 1 ? `${innerHeight / z}px` : "";
}
addEventListener("resize", fit);
fit();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
