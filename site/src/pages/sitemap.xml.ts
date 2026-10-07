import type { APIRoute } from "astro";
import { DOC_PAGES, siteUrl } from "../lib/pages";

export const GET: APIRoute = ({ site }) => {
  const urls = ["", "demos/", "playground/", ...DOC_PAGES.map((page) => page.path)].map((path) => siteUrl(site, path));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
};
