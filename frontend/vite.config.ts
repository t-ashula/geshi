import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  root: import.meta.dirname,
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
      },
    },
  },
});
