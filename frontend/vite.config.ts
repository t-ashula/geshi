import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const backendOrigin =
  process.env.GESHI_BACKEND_ORIGIN ??
  `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? "3000"}`;

export default defineConfig({
  plugins: [vue()],
  root: import.meta.dirname,
  server: {
    proxy: {
      "/api": {
        target: backendOrigin,
      },
      "/media": {
        target: backendOrigin,
      },
    },
  },
});
