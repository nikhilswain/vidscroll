import { fingerprintOf, readCache, writeCache } from "./cache";
import { probeMp4, type VideoProbe } from "./probe";
import { VidscrollError, checkSourceUrl, warnOnce } from "./source";
import {
  probeWithDemuxer,
  transcodeForScrubbing,
  webCodecsAvailable,
} from "./transcode";

export interface OptimizeOptions {
  maxKeyframeGap?: number;
  maxResolution?: number;
  maxFps?: number;
  cache?: boolean;
}

export type LoadPhase = "download" | "optimize";

export interface LoadVideoOptions {
  optimize?: boolean | OptimizeOptions;
  onProgress?: (phase: LoadPhase, value: number) => void;
  signal?: AbortSignal;
}

export interface LoadedVideo {
  url: string;
  source: "original" | "optimized" | "cache" | "stream";
  probe: VideoProbe | null;
  release(): void;
}

const LONG_VIDEO_S = 120;
const LARGE_FILE_BYTES = 100 * 1024 * 1024;
const ENCODE_HINT = "Pre-encode it with `npx vidscroll encode <file>` to skip this.";

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
}

function objectUrlResult(
  blob: Blob,
  source: LoadedVideo["source"],
  probe: VideoProbe | null
): LoadedVideo {
  const url = URL.createObjectURL(blob);
  return { url, source, probe, release: () => URL.revokeObjectURL(url) };
}

export async function loadScrollVideo(
  src: string,
  opts: LoadVideoOptions = {}
): Promise<LoadedVideo> {
  checkSourceUrl(src);
  const { signal, onProgress } = opts;
  const optimize = opts.optimize === false ? null : opts.optimize === true ? {} : opts.optimize ?? {};
  const absoluteSrc = new URL(src, location.href).href;

  let res: Response;
  try {
    res = await fetch(src, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    warnOnce(
      `[vidscroll] Couldn't read "${src}" (network error or CORS). Streaming it ` +
        `directly instead — scrubbing will be slow unless the file is already ` +
        `encoded for it. If it's on another domain, the server must send ` +
        `Access-Control-Allow-Origin for this site.`
    );
    return { url: src, source: "stream", probe: null, release() {} };
  }
  if (!res.ok) {
    throw new VidscrollError("http-error", `[vidscroll] HTTP ${res.status} loading "${src}".`);
  }
  if (/^text\/html/i.test(res.headers.get("content-type") ?? "")) {
    res.body?.cancel().catch(() => {});
    throw new VidscrollError(
      "not-a-video",
      `[vidscroll] "${src}" returned an HTML page, not a video. Check the path — ` +
        `many hosts serve index.html for files that don't exist.`
    );
  }

  const fingerprint = fingerprintOf(res);
  const cacheOn = !!optimize && optimize.cache !== false && fingerprint != null;
  const settings = optimize
    ? [optimize.maxResolution ?? 720, optimize.maxFps ?? "auto", optimize.maxKeyframeGap ?? 0.5].join("-")
    : "";
  if (cacheOn) {
    const cached = await readCache(absoluteSrc, settings, fingerprint!);
    if (cached) {
      res.body?.cancel().catch(() => {});
      onProgress?.("download", 1);
      return objectUrlResult(cached, "cache", null);
    }
  }

  const total = Number(res.headers.get("content-length")) || 0;
  if (total > LARGE_FILE_BYTES) {
    warnOnce(
      `[vidscroll] "${src}" is ${(total / 1048576).toFixed(0)}MB. Every visitor ` +
        `downloads the whole file before scrolling. Consider a shorter or ` +
        `smaller video.`
    );
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = res.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal?.aborted) {
        reader.cancel().catch(() => {});
        aborted(signal);
      }
      if (value) {
        chunks.push(value);
        received += value.length;
        if (total > 0) onProgress?.("download", Math.min(received / total, 1));
      }
      if (done) break;
    }
  } else {
    chunks.push(new Uint8Array(await res.arrayBuffer()));
  }
  onProgress?.("download", 1);
  const blob = new Blob(chunks as BlobPart[], {
    type: res.headers.get("content-type") || "video/mp4",
  });

  let probe = probeMp4(await blob.arrayBuffer());
  if (!probe && webCodecsAvailable()) {
    probe = await probeWithDemuxer(blob).catch(() => null);
  }
  aborted(signal);

  if (probe && probe.duration > LONG_VIDEO_S) {
    warnOnce(
      `[vidscroll] "${src}" is ${Math.round(probe.duration)}s long. Scroll-scrubbed ` +
        `videos work best under ~${LONG_VIDEO_S}s — longer ones mean very long ` +
        `pages and slow first loads.`
    );
  }

  const gapLimit = optimize?.maxKeyframeGap ?? 0.5;
  const needsWork = !probe || probe.maxKeyframeGap > gapLimit;
  if (!needsWork) return objectUrlResult(blob, "original", probe);

  const gapText = probe
    ? `keyframes are up to ${probe.maxKeyframeGap.toFixed(1)}s apart`
    : `its keyframe layout couldn't be read`;
  if (!optimize) {
    warnOnce(`[vidscroll] "${src}" will scrub slowly: ${gapText}. ${ENCODE_HINT}`);
    return objectUrlResult(blob, "original", probe);
  }
  if (!webCodecsAvailable()) {
    warnOnce(
      `[vidscroll] "${src}" will scrub slowly: ${gapText}, and this browser ` +
        `can't re-encode it (no WebCodecs). ${ENCODE_HINT}`
    );
    return objectUrlResult(blob, "original", probe);
  }

  warnOnce(
    `[vidscroll] "${src}" isn't encoded for scrubbing (${gapText}); ` +
      `re-encoding it in the browser. ${ENCODE_HINT}`
  );
  onProgress?.("optimize", 0);
  let optimized: Blob;
  try {
    optimized = await transcodeForScrubbing(blob, {
      maxResolution: optimize.maxResolution ?? 720,
      maxFps: optimize.maxFps ?? (probe && probe.duration > LONG_VIDEO_S ? 15 : 30),
      keyframeInterval: 0.25,
      signal,
      onProgress: (v) => onProgress?.("optimize", v),
    });
  } catch (err) {
    aborted(signal);
    warnOnce(
      `[vidscroll] Re-encoding "${src}" failed (${(err as Error).message}); ` +
        `using the original. ${ENCODE_HINT}`
    );
    return objectUrlResult(blob, "original", probe);
  }
  aborted(signal);
  onProgress?.("optimize", 1);
  if (cacheOn) void writeCache(absoluteSrc, settings, fingerprint!, optimized);
  return objectUrlResult(optimized, "optimized", probe);
}
