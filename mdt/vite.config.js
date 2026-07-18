import { defineConfig } from "vite";
import path from "path";

const port     = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH    || "/";

export default defineConfig({
  base: basePath,
  root: path.resolve("../.."),   // workspace root — where index.html lives
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: path.resolve("../../dist"),
    emptyOutDir: true,
  },
});
