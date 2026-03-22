import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: path.resolve(frontendRoot),
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    outDir: "../dist/frontend",
    emptyOutDir: true,
  },
});
