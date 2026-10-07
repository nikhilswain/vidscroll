import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

process.env.VITE_ASSET_BASE ??= "/";

export default defineConfig({
  root: "demo",
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^vidscroll$/, replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
      { find: /^vidscroll\/core$/, replacement: fileURLToPath(new URL("./src/core/index.ts", import.meta.url)) },
      { find: /^vidscroll\/element$/, replacement: fileURLToPath(new URL("./src/element/index.ts", import.meta.url)) },
    ],
  },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./demo/index.html", import.meta.url)),
        element: fileURLToPath(new URL("./demo/element.html", import.meta.url)),
      },
    },
  },
});
