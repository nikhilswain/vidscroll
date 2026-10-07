import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { vidscrollTheme } from "./src/lib/shiki-theme.mjs";
import { codeMeta } from "./src/lib/shiki-transformers.mjs";

const src = (path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  site: process.env.SITE_URL ?? "https://nikhilswain.github.io",
  base: process.env.SITE_BASE ?? "/vidscroll",
  trailingSlash: "ignore",
  publicDir: "../demo/public",
  outDir: "../dist-site",
  integrations: [react(), mdx()],
  markdown: {
    shikiConfig: { theme: vidscrollTheme, wrap: false, transformers: [codeMeta] },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^vidscroll$/, replacement: src("index.ts") },
        { find: /^vidscroll\/core$/, replacement: src("core/index.ts") },
        { find: /^vidscroll\/element$/, replacement: src("element/index.ts") },
      ],
    },
  },
});
