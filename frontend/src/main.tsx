import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// StrictMode는 개발 중에 첫 요청을 두 번 보내서 API 기록이 헷갈리므로 쓰지 않는다.
createRoot(document.getElementById("root")!).render(<App />);
