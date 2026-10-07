import { fileURLToPath } from "node:url";
import { build } from "vite";

const base = (process.env.SITE_BASE ?? "/").replace(/\/$/, "");
process.env.VITE_ASSET_BASE = `${base}/`;

await build({
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  base: `${base}/demos/`,
  publicDir: false,
  logLevel: "warn",
  build: { outDir: fileURLToPath(new URL("../dist-site/demos", import.meta.url)), emptyOutDir: true },
});
