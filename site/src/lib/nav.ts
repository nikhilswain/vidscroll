export interface NavItem {
  title: string;
  slug?: string;
  experimental?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Start here",
    items: [
      { title: "Introduction", slug: "start/introduction" },
      { title: "How it works", slug: "start/how-it-works" },
    ],
  },
  {
    title: "Get started",
    items: [
      { title: "React", slug: "get-started/react" },
      { title: "Next.js", slug: "get-started/nextjs" },
      { title: "Astro", slug: "get-started/astro" },
      { title: "Plain HTML", slug: "get-started/html", experimental: true },
    ],
  },
  {
    title: "React API",
    items: [
      { title: "ScrollVideo", slug: "react/scroll-video" },
      { title: "Section", slug: "react/section" },
      { title: "Hooks", slug: "react/hooks" },
      { title: "ScrollFrames", slug: "react/scroll-frames" },
    ],
  },
  {
    title: "Without React",
    items: [
      { title: "<vid-scroll>", slug: "without-react/element", experimental: true },
      { title: "vidscroll/core", slug: "without-react/core", experimental: true },
    ],
  },
  {
    title: "Preparing videos",
    items: [
      { title: "Why seeking stutters", slug: "videos/why-seeking-stutters" },
      { title: "Automatic optimization", slug: "videos/automatic-optimization" },
      { title: "Pre-encoding with the CLI", slug: "videos/cli" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Text synced to the video", slug: "guides/text" },
      { title: "Scroll-driven CSS", slug: "guides/scroll-driven-css" },
      { title: "Chapter navigation", slug: "guides/chapters" },
      { title: "Live values", slug: "guides/live-values" },
      { title: "Custom loaders", slug: "guides/loaders" },
      { title: "Easing and feel", slug: "guides/easing" },
      { title: "Videos from other domains", slug: "guides/other-domains" },
      { title: "Measuring on real devices", slug: "guides/measuring" },
      { title: "Accessibility", slug: "guides/accessibility" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "Controller API and events", slug: "reference/api" },
      { title: "Styling hooks", slug: "reference/styling" },
      { title: "Errors and warnings", slug: "reference/errors" },
      { title: "TypeScript types", slug: "reference/types" },
      { title: "CLI", slug: "reference/cli" },
      { title: "Browser support", slug: "reference/browser-support" },
    ],
  },
  {
    title: "More",
    items: [
      { title: "Troubleshooting", slug: "troubleshooting" },
      { title: "Changelog", slug: "changelog" },
    ],
  },
];

export const docsHref = (slug: string) => `docs/${slug}/`;

export function neighbours(slug: string) {
  const pages = NAV.flatMap((g) => g.items.map((item) => ({ ...item, group: g.title })));
  const index = pages.findIndex((p) => p.slug === slug);
  return {
    current: pages[index],
    prev: index > 0 ? pages[index - 1] : undefined,
    next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : undefined,
  };
}
