import { fileURLToPath } from "node:url";

export function demosDev(base) {
  const root = `${base.replace(/\/$/, "")}/`;
  const prefix = `${root}demos/`;
  return {
    name: "vidscroll-demos-dev",
    hooks: {
      "astro:server:setup": async ({ server }) => {
        process.env.VITE_ASSET_BASE = root;
        const { createServer } = await import("vite");
        const demos = await createServer({
          configFile: fileURLToPath(new URL("../../../vite.config.ts", import.meta.url)),
          base: prefix,
          appType: "mpa",
          logLevel: "warn",
          server: { middlewareMode: true, hmr: { server: server.httpServer ?? undefined } },
        });
        server.httpServer?.once("close", () => demos.close());
        server.middlewares.use((req, res, next) => {
          const url = req.originalUrl ?? req.url ?? "";
          if (url === prefix.slice(0, -1)) {
            res.writeHead(301, { Location: prefix });
            res.end();
          } else if (url.startsWith(prefix)) {
            req.url = url;
            demos.middlewares(req, res, next);
          } else {
            next();
          }
        });
      },
    },
  };
}
