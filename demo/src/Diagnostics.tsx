import { useEffect, useRef, useState } from "react";

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

interface Frame {
  at: number;
  delta: number;
}

interface Readout {
  status: string;
  fps: number;
  speed: number;
  jumpMedian: number;
  jumpMax: number;
  seekMs: number;
  mode: string;
  pageFps: number;
  longFrames: number;
  session: SessionSummary;
}

interface SessionSummary {
  usableAfterS: number | null;
  reencodeS: number | null;
  reencoding: boolean;
  fpsMedian: number;
  fpsLow: number;
  jumpMedian: number;
  jumpP95: number;
  jumpMax: number;
  seekMedianMs: number;
  seekCount: number;
  plays: number;
  pageFpsMedian: number;
  longFrames: number;
}

const MIN_FRAME_S = 1 / 240;
const MAX_HISTORY = 20000;

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

const round = (value: number, digits = 0) => Number(value.toFixed(digits));

function visibleVideo(): FrameVideo | null {
  let best: FrameVideo | null = null;
  let bestHeight = 0;
  for (const stage of document.querySelectorAll<HTMLElement>("[data-vidscroll-stage]")) {
    const rect = stage.getBoundingClientRect();
    const height = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
    const video = stage.querySelector<FrameVideo>(
      "video[data-vidscroll-media]:not([data-vidscroll-next]):not([data-vidscroll-preview])"
    );
    if (video && height > bestHeight) {
      best = video;
      bestHeight = height;
    }
  }
  return best;
}

function deviceLine() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = navigator.userAgent;
  const browser =
    /Edg\/[\d.]+/.exec(ua)?.[0] ??
    /(?:CriOS|Chrome)\/[\d.]+/.exec(ua)?.[0] ??
    /(?:FxiOS|Firefox)\/[\d.]+/.exec(ua)?.[0] ??
    /Version\/[\d.]+.*Safari/.exec(ua)?.[0].replace(/ .*/, " Safari") ??
    "unknown browser";
  const os = /iPhone OS [\d_]+|iPad|Android [\d.]+|Windows NT [\d.]+|Mac OS X [\d_]+|Linux/.exec(ua)?.[0] ?? "unknown OS";
  return [
    `${browser}, ${os.replace(/_/g, ".")}`,
    `${navigator.hardwareConcurrency ?? "?"} cores, ${nav.deviceMemory ?? "?"} GB`,
    `${screen.width}x${screen.height}@${devicePixelRatio}`,
    `https=${isSecureContext}, webcodecs=${typeof VideoEncoder !== "undefined"}`,
  ].join(" | ");
}

function useCollector(enabled: boolean) {
  const [readout, setReadout] = useState<Readout | null>(null);
  const report = useRef<() => string>(() => "");
  const reset = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    const openedAt = performance.now();
    let frames: Frame[] = [];
    let deltas: number[] = [];
    let fpsSamples: number[] = [];
    let pageFpsSamples: number[] = [];
    let seekDurations: number[] = [];
    let rafTimes: number[] = [];
    let longFrameTimes: number[] = [];
    let longFramesTotal = 0;
    let plays = 0;
    let frameS = Infinity;
    let video: FrameVideo | null = null;
    let lastMedia = NaN;
    let seekStart = 0;
    let handle = 0;
    let rafId = 0;
    let lastRaf = 0;
    let usableAfterS: number | null = null;
    let badgeSince: number | null = null;
    let reencodeS: number | null = null;
    let lastScrollAt = -Infinity;
    let covered = true;
    const onScroll = () => (lastScrollAt = performance.now());
    window.addEventListener("scroll", onScroll, { passive: true });
    const scrolling = (now: number) => !covered && now - lastScrollAt < 500;

    const onFrame = (now: number, meta: { mediaTime: number }) => {
      if (!video) return;
      if (!Number.isNaN(lastMedia)) {
        const delta = Math.abs(meta.mediaTime - lastMedia);
        if (delta >= MIN_FRAME_S && scrolling(now)) {
          frameS = Math.min(frameS, delta);
          frames.push({ at: now, delta });
          if (deltas.length < MAX_HISTORY) deltas.push(delta);
        }
      }
      lastMedia = meta.mediaTime;
      handle = video.requestVideoFrameCallback?.(onFrame) ?? 0;
    };
    const onSeeking = () => (seekStart = performance.now());
    const onSeeked = () => {
      if (seekStart && seekDurations.length < MAX_HISTORY) seekDurations.push(performance.now() - seekStart);
      seekStart = 0;
    };
    const onPlay = () => plays++;

    const detach = () => {
      if (!video) return;
      if (handle) video.cancelVideoFrameCallback?.(handle);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("play", onPlay);
      video = null;
    };
    const attach = (next: FrameVideo) => {
      detach();
      video = next;
      lastMedia = NaN;
      next.addEventListener("seeking", onSeeking);
      next.addEventListener("seeked", onSeeked);
      next.addEventListener("play", onPlay);
      handle = next.requestVideoFrameCallback?.(onFrame) ?? 0;
    };

    const onRaf = (now: number) => {
      if (lastRaf && now - lastRaf > 50) {
        longFrameTimes.push(now);
        longFramesTotal++;
      }
      lastRaf = now;
      rafTimes.push(now);
      rafId = requestAnimationFrame(onRaf);
    };
    rafId = requestAnimationFrame(onRaf);

    const toFrames = (delta: number) => (Number.isFinite(frameS) ? delta / frameS : 0);

    const summary = (): SessionSummary => {
      const jumps = deltas.map(toFrames);
      return {
        usableAfterS,
        reencodeS,
        reencoding: badgeSince != null,
        fpsMedian: round(percentile(fpsSamples, 0.5)),
        fpsLow: round(percentile(fpsSamples, 0.1)),
        jumpMedian: round(percentile(jumps, 0.5), 1),
        jumpP95: round(percentile(jumps, 0.95), 1),
        jumpMax: round(percentile(jumps, 1), 1),
        seekMedianMs: round(percentile(seekDurations, 0.5)),
        seekCount: seekDurations.length,
        plays,
        pageFpsMedian: round(percentile(pageFpsSamples, 0.5)),
        longFrames: longFramesTotal,
      };
    };

    const tick = () => {
      const now = performance.now();
      const next = visibleVideo();
      if (next !== video && next) attach(next);

      const stage = video?.closest("[data-vidscroll-stage]");
      const loader = stage?.querySelector<HTMLElement>("[data-vidscroll-loader]");
      const background = loader?.hasAttribute("data-background") ?? false;
      covered = loader != null && !background;
      if (!loader?.matches(":not([data-background])") && usableAfterS == null && video?.getAttribute("src")) {
        usableAfterS = round((now - openedAt) / 1000, 1);
      }
      if (background && badgeSince == null && reencodeS == null) badgeSince = now;
      if (!background && badgeSince != null) {
        reencodeS = round((now - badgeSince) / 1000, 1);
        badgeSince = null;
      }

      frames = frames.filter((f) => now - f.at < 2000);
      rafTimes = rafTimes.filter((t) => now - t < 1000);
      longFrameTimes = longFrameTimes.filter((t) => now - t < 5000);
      const lastSecond = frames.filter((f) => now - f.at < 1000);
      const travelled = lastSecond.reduce((sum, f) => sum + f.delta, 0);
      const moving = scrolling(now) && Number.isFinite(frameS) && travelled > 2 * frameS;
      if (moving) fpsSamples.push(lastSecond.length);
      pageFpsSamples.push(rafTimes.length);
      const recentJumps = frames.map((f) => toFrames(f.delta));

      const status = !video
        ? "no video on screen"
        : loader
          ? `${loader.dataset.phase}${background ? " (scrollable)" : ""} ${/\d+%/.exec(loader.textContent ?? "")?.[0] ?? ""}`.trim()
          : video.getAttribute("src")?.startsWith("blob:")
            ? "ready (downloaded)"
            : "ready (streaming)";

      setReadout({
        status,
        fps: moving ? lastSecond.length : 0,
        speed: round(travelled, 1),
        jumpMedian: round(percentile(recentJumps, 0.5), 1),
        jumpMax: round(percentile(recentJumps, 1), 1),
        seekMs: round(percentile(seekDurations.slice(-10), 0.5)),
        mode: !video ? "-" : video.seeking ? "seeking" : video.paused ? "paused" : "playing",
        pageFps: rafTimes.length,
        longFrames: longFrameTimes.length,
        session: summary(),
      });
    };
    const interval = window.setInterval(tick, 250);

    report.current = () => {
      const s = summary();
      return [
        `vidscroll stats: ${location.hash || "#/"} on ${new Date().toISOString()}`,
        `device: ${deviceLine()}`,
        `usable after: ${s.usableAfterS ?? "?"} s | re-encode: ${s.reencoding ? "still running" : s.reencodeS != null ? `${s.reencodeS} s` : "none seen"}`,
        `frames shown/s while scrolling: median ${s.fpsMedian}, low (10th pct) ${s.fpsLow}`,
        `jump between shown frames: median ${s.jumpMedian}, p95 ${s.jumpP95}, max ${s.jumpMax} frames`,
        `seeks: median ${s.seekMedianMs} ms (${s.seekCount}) | plays: ${s.plays}`,
        `page: median ${s.pageFpsMedian} fps, ${s.longFrames} frames over 50 ms`,
      ].join("\n");
    };
    reset.current = () => {
      deltas = [];
      fpsSamples = [];
      pageFpsSamples = [];
      seekDurations = [];
      longFramesTotal = 0;
      plays = 0;
    };

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
      detach();
    };
  }, [enabled]);

  return { readout, report, reset };
}

export function Diagnostics() {
  const enabled = new URLSearchParams(location.search).has("stats");
  const { readout, report, reset } = useCollector(enabled);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  if (!enabled || !readout) return null;

  const copy = async () => {
    const text = report.current();
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      setCopied(text);
    }
  };

  const s = readout.session;
  return (
    <aside className="stats" aria-label="Playback stats">
      <button type="button" className="stats__toggle" onClick={() => setOpen(!open)}>
        {open ? "Hide stats" : "Stats"}
      </button>
      {open && (
        <>
          <dl>
            <dt>Video</dt>
            <dd>{readout.status}</dd>
            <dt>Now</dt>
            <dd>
              {readout.fps} fps shown, {readout.speed}s/s, {readout.mode}
            </dd>
            <dt>Jumps</dt>
            <dd>
              median {readout.jumpMedian}, max {readout.jumpMax} frames
            </dd>
            <dt>Seek</dt>
            <dd>{readout.seekMs} ms</dd>
            <dt>Page</dt>
            <dd>
              {readout.pageFps} fps, {readout.longFrames} slow frames (5 s)
            </dd>
            <dt>Session</dt>
            <dd>
              {s.fpsMedian} fps (low {s.fpsLow}), jumps p95 {s.jumpP95}, max {s.jumpMax}
            </dd>
            <dt>Load</dt>
            <dd>
              usable {s.usableAfterS ?? "?"} s, re-encode{" "}
              {s.reencoding ? "running" : s.reencodeS != null ? `${s.reencodeS} s` : "none"}
            </dd>
          </dl>
          <div className="stats__actions">
            <button type="button" onClick={copy}>
              Copy report
            </button>
            <button type="button" onClick={() => reset.current()}>
              Reset
            </button>
          </div>
          {copied && copied !== "Copied" && <textarea readOnly value={copied} rows={7} />}
          {copied === "Copied" && <p className="stats__note">Copied to clipboard</p>}
        </>
      )}
    </aside>
  );
}
