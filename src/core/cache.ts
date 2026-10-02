// Optimized videos are kept in Cache Storage so only the first visit pays for
// the in-browser transcode. Entries are validated against the source's
// response headers, so a changed file at the same URL is re-optimized.

const CACHE_NAME = "vidscroll-v1";
const FINGERPRINT_HEADER = "x-vidscroll-fingerprint";

function available() {
  return typeof caches !== "undefined";
}

function cacheUrl(src: string, settings: string) {
  return `https://vidscroll.cache/${encodeURIComponent(src)}/${settings}`;
}

/** Identify a source file version from response headers; null if unknowable. */
export function fingerprintOf(res: Response): string | null {
  const parts = ["content-length", "etag", "last-modified"].map(
    (h) => res.headers.get(h) ?? ""
  );
  return parts.some(Boolean) ? parts.join("|") : null;
}

export async function readCache(
  src: string,
  settings: string,
  fingerprint: string
): Promise<Blob | null> {
  if (!available()) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheUrl(src, settings));
    if (!hit || hit.headers.get(FINGERPRINT_HEADER) !== fingerprint) return null;
    return await hit.blob();
  } catch {
    return null; // storage blocked (private mode, quota) — just re-optimize
  }
}

export async function writeCache(
  src: string,
  settings: string,
  fingerprint: string,
  blob: Blob
): Promise<void> {
  if (!available()) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    // Drop stale versions of this source (other settings or file versions).
    const prefix = cacheUrl(src, "");
    for (const req of await cache.keys()) {
      if (req.url.startsWith(prefix)) await cache.delete(req);
    }
    await cache.put(
      cacheUrl(src, settings),
      new Response(blob, {
        headers: { "content-type": blob.type, [FINGERPRINT_HEADER]: fingerprint },
      })
    );
  } catch {
    /* quota exceeded etc. — caching is best-effort */
  }
}
