import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server + build for the demo app in demo/. The library itself is built
// with tsup (see tsup.config.ts); the demo imports it from source.
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
