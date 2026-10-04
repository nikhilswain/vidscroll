import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.app.json",
  sourcemap: true,
  clean: true,
  target: "es2020",
  banner: { js: '"use client";' },
  external: ["react", "mediabunny"],
});
