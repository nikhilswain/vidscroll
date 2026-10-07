import type { APIRoute } from "astro";
import { DOC_PAGES, siteUrl } from "../lib/pages";

export const GET: APIRoute = ({ site }) => {
  const groups = [...new Set(DOC_PAGES.map((page) => page.group))];
  const sections = groups.map((group) => {
    const lines = DOC_PAGES.filter((page) => page.group === group).map(
      (page) => `- [${page.title}](${siteUrl(site, page.path)}): ${page.description}`
    );
    return `## ${group}\n\n${lines.join("\n")}`;
  });
  const body = `# vidscroll

> Scroll-scrubbed video for React, with an experimental <vid-scroll> custom element and a plain JavaScript controller (vidscroll/core). Scrolling moves a video frame by frame. Videos with keyframes far apart are re-encoded in the browser with WebCodecs and cached, or prepared ahead of time with \`npx vidscroll encode\`.

Install with \`npm i vidscroll\`. React components: ScrollVideo, Section, ScrollFrames, and the hooks useScrollVideo, useScrollVideoState and useScrollVideoUpdate. Source: https://github.com/nikhilswain/vidscroll

${sections.join("\n\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
