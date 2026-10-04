export type VidscrollErrorCode =
  | "unsupported-url"
  | "http-error"
  | "not-a-video";

export class VidscrollError extends Error {
  readonly code: VidscrollErrorCode;
  constructor(code: VidscrollErrorCode, message: string) {
    super(message);
    this.name = "VidscrollError";
    this.code = code;
  }
}

const PAGE_HOSTS: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)vimeo\.com$/, "Vimeo"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.watch)$/, "Facebook"],
  [/(^|\.)(twitter\.com|x\.com)$/, "X/Twitter"],
  [/(^|\.)dailymotion\.com$/, "Dailymotion"],
  [/(^|\.)twitch\.tv$/, "Twitch"],
];

export function checkSourceUrl(src: string): void {
  let url: URL;
  try {
    url = new URL(src, typeof location !== "undefined" ? location.href : undefined);
  } catch {
    return;
  }

  const looksLikeFile = /\.(mp4|m4v|mov|webm|mkv)$/i.test(url.pathname);
  const page = PAGE_HOSTS.find(([re]) => re.test(url.hostname));
  if (page && !looksLikeFile) {
    throw new VidscrollError(
      "unsupported-url",
      `[vidscroll] "${src}" is a ${page[1]} page, not a video file. ` +
        `${page[1]} videos can't be scrubbed — their streams are signed, expire, ` +
        `and can't be read by other sites. Use a video file you host instead ` +
        `(e.g. in your public folder or on a CDN).`
    );
  }
  if (/\.(m3u8|mpd)$/i.test(url.pathname)) {
    throw new VidscrollError(
      "unsupported-url",
      `[vidscroll] "${src}" is an adaptive stream (HLS/DASH). Streams are built ` +
        `for linear playback and can't be scrubbed frame by frame. Use a single ` +
        `video file (.mp4/.webm) instead.`
    );
  }
}

const warned = new Set<string>();

export function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}
