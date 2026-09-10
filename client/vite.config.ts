import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend Phase 1: this SPA shell is a placeholder. API base comes from VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
