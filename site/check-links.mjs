import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist-site");
const base = (process.env.SITE_BASE ?? "/vidscroll").replace(/\/$/, "");
const siteUrl = `${(process.env.SITE_URL ?? "https://nikhilswain.github.io").replace(/\/$/, "")}${base}`;
const origin = "http://site.local";

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });

const decode = (value) => value.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"');

const idCache = new Map();
const idsOf = (file) => {
  if (!idCache.has(file)) {
    const html = readFileSync(file, "utf8");
    idCache.set(file, new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => decode(m[1]))));
  }
  return idCache.get(file);
};

const resolveFile = (pathname) => {
  if (!pathname.startsWith(`${base}/`) && pathname !== base) return null;
  const local = join(dist, decodeURIComponent(pathname.slice(base.length)));
  if (pathname.endsWith("/")) return join(local, "index.html");
  if (existsSync(local) && statSync(local).isDirectory()) return join(local, "index.html");
  return local;
};

const problems = [];
let checked = 0;

const check = (raw, pageUrl, where) => {
  const value = decode(raw.trim());
  if (!value || /^(mailto|data|javascript|blob|tel):/.test(value) || value.startsWith("#/")) return;
  const absolute = value.startsWith(siteUrl) ? value.replace(siteUrl, `${origin}${base}`) : value;
  const url = new URL(absolute, pageUrl);
  if (url.origin !== origin) return;
  checked++;
  const file = resolveFile(url.pathname);
  if (!file || !existsSync(file)) {
    problems.push(`${where}: ${value} (no such page or file)`);
    return;
  }
  const hash = decodeURIComponent(url.hash.slice(1));
  if (hash && !hash.startsWith("/") && file.endsWith(".html") && !idsOf(file).has(hash)) {
    problems.push(`${where}: ${value} (no #${hash} on that page)`);
  }
};

for (const file of htmlFiles(dist)) {
  const path = relative(dist, file).replace(/\\/g, "/");
  const pageUrl = `${origin}${base}/${path.replace(/(^|\/)index\.html$/, "$1")}`;
  const html = readFileSync(file, "utf8");
  for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const match of tag.matchAll(/\s(?:href|src)="([^"]*)"/g)) check(match[1], pageUrl, path);
  }
}

for (const doc of ["README.md", "CHANGELOG.md", "CONTRIBUTING.md"]) {
  const text = readFileSync(join(root, doc), "utf8");
  for (const match of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (match[1].startsWith(siteUrl)) check(match[1], `${origin}${base}/`, doc);
  }
}

if (problems.length) {
  console.error(`${problems.length} broken link${problems.length === 1 ? "" : "s"}:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`${checked} internal links ok`);
