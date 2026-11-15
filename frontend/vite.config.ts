import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 가짜 서버를 끄면(VITE_USE_MOCK=false) /api 요청을 로컬 FastAPI로 넘긴다.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
