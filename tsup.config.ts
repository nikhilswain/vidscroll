import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", core: "src/core/index.ts" },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.app.json",
  sourcemap: true,
  clean: true,
  target: "es2020",
  external: ["react", "mediabunny"],
});
