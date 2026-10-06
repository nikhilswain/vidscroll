import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", core: "src/core/index.ts", element: "src/element/index.ts" },
    format: ["esm"],
    dts: true,
    tsconfig: "tsconfig.app.json",
    sourcemap: true,
    target: "es2020",
    external: ["react", "mediabunny"],
  },
  {
    entry: { "vidscroll-element": "src/element/index.ts" },
    outDir: "dist/cdn",
    platform: "browser",
    format: ["esm"],
    tsconfig: "tsconfig.app.json",
    minify: true,
    target: "es2020",
    noExternal: ["mediabunny"],
  },
]);
