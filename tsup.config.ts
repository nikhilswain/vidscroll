import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.app.json",
  sourcemap: true,
  clean: true,
  target: "es2020",
  // Hooks and effects: mark the bundle as a client module for React Server
  // Components frameworks (Next.js app router).
  banner: { js: '"use client";' },
  external: ["react", "mediabunny"],
});
