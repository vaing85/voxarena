import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In dev, proxy API + Socket.IO to the backend so the app can use same-origin
// relative URLs. Override the target with VITE_API_URL for other setups.
const API = process.env.VITE_API_URL ?? "http://localhost:3000";
const apiPaths = [
  "/players",
  "/songs",
  "/performances",
  "/leaderboard",
  "/matchmaking",
  "/bot",
  "/store",
  "/health",
  "/socket.io",
];

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      apiPaths.map((p) => [p, { target: API, changeOrigin: true, ws: p === "/socket.io" }])
    ),
  },
  test: {
    environment: "node",
  },
});
