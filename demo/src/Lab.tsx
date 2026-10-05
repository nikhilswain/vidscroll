import { useEffect, useRef, useState } from "react";
import { deviceLine } from "./device";

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
};

type Mode = "seek" | "chain" | "play" | "decode" | "random";

interface Test {
  name: string;
  mode: Mode;
  speed: number;
}

interface Result {
  name: string;
  shownFps: number;
  lagS: number;
  opsPerS: number;
  opMs: number;
  pageFps: number;
}

interface Kit {
  video: FrameVideo;
  canvas: HTMLCanvasElement;
  sink: import("mediabunny").CanvasSink | null;
}

const SRC = "/commute.mp4";
const RUN_MS = 4000;

const TESTS: Test[] = [
  { name: "video seek 1x fwd", mode: "seek", speed: 1 },
  { name: "video seek 3x fwd", mode: "seek", speed: 3 },
  { name: "video seek 1x back", mode: "seek", speed: -1 },
  { name: "video seek chained 1x fwd", mode: "chain", speed: 1 },
  { name: "video play 1x fwd", mode: "play", speed: 1 },
  { name: "video play 3x fwd", mode: "play", speed: 3 },
  { name: "canvas decode 1x fwd", mode: "decode", speed: 1 },
  { name: "canvas decode 3x fwd", mode: "decode", speed: 3 },
  { name: "canvas decode 1x back", mode: "random", speed: -1 },
];

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};
const round = (value: number, digits = 0) => Number(value.toFixed(digits));

async function seekVideo(video: HTMLVideoElement, time: number) {
  const done = new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
  video.currentTime = time;
  await done;
}

async function run(test: Test, kit: Kit): Promise<Result> {
  const { video, canvas, sink } = kit;
  const start = test.speed < 0 ? 16 : 6;
  const showCanvas = test.mode === "decode" || test.mode === "random";
  video.style.visibility = showCanvas ? "hidden" : "visible";
  canvas.style.visibility = showCanvas ? "visible" : "hidden";
  video.pause();
  video.playbackRate = 1;
  await seekVideo(video, start);
  await sleep(400);

  let t0 = 0;
  let running = true;
  let shown = 0;
  let lagSum = 0;
  let ops = 0;
  const opDurations: number[] = [];
  const targetAt = (now: number) => Math.max(0, start + (test.speed * (now - t0)) / 1000);
  const count = (now: number, mediaTime: number) => {
    shown++;
    lagSum += Math.abs(targetAt(now) - mediaTime);
  };

  let lastMedia = -1;
  const onFrame = (now: number, meta: { mediaTime: number }) => {
    if (!running) return;
    if (meta.mediaTime !== lastMedia && t0) {
      lastMedia = meta.mediaTime;
      count(now, meta.mediaTime);
    }
    video.requestVideoFrameCallback?.(onFrame);
  };

  let requested = start;
  let seekStartedAt = 0;
  const seek = (time: number) => {
    requested = time;
    seekStartedAt = performance.now();
    ops++;
    video.currentTime = time;
  };
  const onSeeked = () => {
    opDurations.push(performance.now() - seekStartedAt);
    if (test.mode !== "chain" || !running) return;
    const time = targetAt(performance.now());
    if (Math.abs(time - requested) >= 1 / 60) seek(time);
  };

  const ctx = canvas.getContext("2d")!;
  type Wrapped = { canvas: HTMLCanvasElement | OffscreenCanvas; timestamp: number };
  const queue: Wrapped[] = [];
  let drawn = -1;
  let iterator: AsyncGenerator<Wrapped, void, unknown> | null = null;
  let randomBusy = false;
  const draw = (frame: Wrapped, now: number) => {
    if (frame.timestamp === drawn) return;
    drawn = frame.timestamp;
    ctx.drawImage(frame.canvas, 0, 0, canvas.width, canvas.height);
    count(now, frame.timestamp);
  };

  if (!showCanvas) {
    video.addEventListener("seeked", onSeeked);
    video.requestVideoFrameCallback?.(onFrame);
  } else if (sink && test.mode === "decode") {
    iterator = sink.canvases(start);
    void (async () => {
      let pulledAt = performance.now();
      for (;;) {
        while (running && queue.length >= 3) await nextFrame();
        if (!running) break;
        const next = await iterator!.next();
        if (next.done) break;
        opDurations.push(performance.now() - pulledAt);
        pulledAt = performance.now();
        ops++;
        queue.push(next.value);
      }
    })();
  }

  let pageFrames = 0;
  t0 = await nextFrame();
  if (test.mode === "play") {
    video.playbackRate = test.speed;
    ops++;
    await video.play().catch(() => {});
  }

  for (;;) {
    const now = await nextFrame();
    pageFrames++;
    if (now - t0 >= RUN_MS) break;
    const time = targetAt(now);
    if (test.mode === "play") {
      const lead = time - video.currentTime;
      video.playbackRate = clamp(test.speed + lead * 2, 0.1, 16);
    } else if (test.mode === "seek" || test.mode === "chain") {
      if (!video.seeking && Math.abs(time - requested) >= 1 / 60) seek(time);
    } else if (test.mode === "decode") {
      let latest: Wrapped | null = null;
      while (queue.length && queue[0].timestamp <= time) latest = queue.shift()!;
      if (latest) draw(latest, now);
    } else if (test.mode === "random" && sink && !randomBusy && Math.abs(time - requested) >= 1 / 60) {
      randomBusy = true;
      requested = time;
      const askedAt = performance.now();
      void sink.getCanvas(time).then((frame) => {
        opDurations.push(performance.now() - askedAt);
        ops++;
        randomBusy = false;
        if (frame && running) draw(frame, performance.now());
      });
    }
  }

  running = false;
  video.pause();
  video.playbackRate = 1;
  video.removeEventListener("seeked", onSeeked);
  await iterator?.return();
  const seconds = RUN_MS / 1000;
  return {
    name: test.name,
    shownFps: round(shown / seconds),
    lagS: round(shown ? lagSum / shown : 0, 2),
    opsPerS: round(ops / seconds),
    opMs: round(median(opDurations)),
    pageFps: round(pageFrames / seconds),
  };
}

function report(results: Result[]) {
  return [
    `vidscroll lab: ${new Date().toISOString()}`,
    `device: ${deviceLine()}`,
    "test | frames shown/s | lag s | ops/s | op ms | page fps",
    ...results.map((r) => `${r.name} | ${r.shownFps} | ${r.lagS} | ${r.opsPerS} | ${r.opMs} | ${r.pageFps}`),
  ].join("\n");
}

export function Lab() {
  const videoRef = useRef<FrameVideo | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kitRef = useRef<Kit | null>(null);
  const [status, setStatus] = useState("Loading the video…");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url = "";
    (async () => {
      const blob = await (await fetch(SRC)).blob();
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      video.src = url;
      await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
      let sink: Kit["sink"] = null;
      if (typeof VideoDecoder !== "undefined") {
        const mb = await import("mediabunny");
        const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
        const track = await input.getPrimaryVideoTrack();
        if (track) {
          canvas.width = await track.getDisplayWidth();
          canvas.height = await track.getDisplayHeight();
          sink = new mb.CanvasSink(track, { poolSize: 6 });
        }
      }
      if (cancelled) return;
      kitRef.current = { video, canvas, sink };
      setStatus(sink ? "Ready" : "Ready (no WebCodecs: canvas tests will be skipped)");
      setBusy(false);
    })().catch((err: Error) => setStatus(`Failed to load: ${err.message}`));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const runAll = async () => {
    const kit = kitRef.current;
    if (!kit) return;
    setBusy(true);
    setCopied(null);
    setResults([]);
    const done: Result[] = [];
    for (const [index, test] of TESTS.entries()) {
      if (!kit.sink && (test.mode === "decode" || test.mode === "random")) continue;
      setStatus(`Running ${index + 1}/${TESTS.length}: ${test.name}. Don't touch the screen.`);
      done.push(await run(test, kit));
      setResults([...done]);
    }
    setStatus("Done. Tap Copy report and paste it.");
    setBusy(false);
  };

  const copy = async () => {
    const text = report(results);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      setCopied(text);
    }
  };

  return (
    <main className="lab">
      <div className="lab__stage">
        <video ref={videoRef} muted playsInline preload="auto" />
        <canvas ref={canvasRef} />
      </div>
      <section className="lab__panel">
        <h1>Playback lab</h1>
        <p>{status}</p>
        <div className="lab__actions">
          <button type="button" onClick={runAll} disabled={busy}>
            Run all
          </button>
          <button type="button" onClick={copy} disabled={busy || results.length === 0}>
            Copy report
          </button>
        </div>
        {results.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Shown/s</th>
                <th>Lag s</th>
                <th>Ops/s</th>
                <th>Op ms</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.shownFps}</td>
                  <td>{r.lagS}</td>
                  <td>{r.opsPerS}</td>
                  <td>{r.opMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {copied === "Copied" && <p>Copied to clipboard</p>}
        {copied && copied !== "Copied" && <textarea readOnly value={copied} rows={12} />}
      </section>
    </main>
  );
}
