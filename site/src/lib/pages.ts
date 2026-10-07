import { NAV, docsHref } from "./nav";

const modules = import.meta.glob<{ frontmatter: { slug: string; description: string } }>("../pages/docs/**/*.mdx", {
  eager: true,
});

const descriptions = new Map(Object.values(modules).map((m) => [m.frontmatter.slug, m.frontmatter.description]));
descriptions.set("changelog", "What changed in each published version.");

export const DOC_PAGES = NAV.flatMap((group) =>
  group.items
    .filter((item) => item.slug)
    .map((item) => ({
      group: group.title,
      title: item.title,
      path: docsHref(item.slug!),
      description: descriptions.get(item.slug!) ?? "",
    }))
);

export const siteUrl = (site: URL | undefined, path = "") =>
  new URL(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path}`, site).href;
