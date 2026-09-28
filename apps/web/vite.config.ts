import react from "@vitejs/plugin-react";
import JSON5 from "json5";
import { defineConfig, type Plugin } from "vite";

/** Loads the shared `.json5` data files as plain objects; the client validates them on start. */
const json5: Plugin = {
  name: "wipe-day-json5",
  transform(code, id) {
    if (!id.endsWith(".json5")) return null;
    return { code: `export default ${JSON.stringify(JSON5.parse(code))};`, map: null };
  },
};

export default defineConfig({
  plugins: [react(), json5],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // The API runs next to Vite in development (`pnpm dev`); same origin, so cookies just work.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: false } },
  },
});
