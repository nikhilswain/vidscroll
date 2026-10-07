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
      { title: "ScrollFrames" },
    ],
  },
  {
    title: "Without React",
    items: [
      { title: "<vid-scroll>", experimental: true },
      { title: "vidscroll/core", experimental: true },
    ],
  },
  {
    title: "Preparing videos",
    items: [
      { title: "Why seeking stutters" },
      { title: "Automatic optimization" },
      { title: "Pre-encoding with the CLI" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Text synced to the video" },
      { title: "Scroll-driven CSS" },
      { title: "Chapter navigation" },
      { title: "Progress indicators" },
      { title: "Live values" },
      { title: "Custom loaders" },
      { title: "Easing and feel" },
      { title: "Videos from other domains" },
      { title: "Measuring on real devices" },
      { title: "Accessibility" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "Controller API and events" },
      { title: "Styling hooks" },
      { title: "Errors and warnings" },
      { title: "TypeScript types" },
      { title: "CLI" },
      { title: "Browser support" },
    ],
  },
  {
    title: "More",
    items: [{ title: "Troubleshooting" }, { title: "Changelog" }],
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
