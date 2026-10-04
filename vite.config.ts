import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "demo",
  plugins: [react()],
  resolve: {
    alias: {
      vidscroll: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
});
