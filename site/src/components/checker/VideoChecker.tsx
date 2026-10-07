import { useState } from "react";
import type { DragEvent, ReactNode } from "react";
import {
  GAP_LIMIT,
  LARGE_FILE_BYTES,
  LONG_VIDEO_S,
  analyzeFile,
  codecName,
  measureSeeks,
} from "./analyze";
import type { Analysis, SeekResult } from "./analyze";
import "../../styles/checker.css";

type State =
  | { phase: "idle" }
  | { phase: "working"; name: string; step: string }
  | { phase: "done"; file: File; analysis: Analysis | null; seeks: SeekResult; error: string | null };

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

const clock = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m ? `${m}:${s.toFixed(1).padStart(4, "0")}` : `${s.toFixed(1)} s`;
};

const quote = (name: string) => (/[^\w./-]/.test(name) ? `"${name}"` : name);

function commandFor(a: Analysis) {
  const lines = [`npx vidscroll encode ${quote(a.name)}`];
  const output = a.name.replace(/\.[^.]+$/, "") + ".scroll.mp4";
  lines.push(`# writes ${output}`);
  if (Math.min(a.width, a.height) > 720) lines.push("# sharper but bigger: add --resolution 1080");
  if (a.fps > 31) lines.push("# smaller file: add --fps 30");
  return lines.join("\n");
}

function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className={`code__copy${copied ? " is-copied" : ""}`} onClick={copy} aria-label="Copy command" title="Copy">
      <svg className="code__copy-icon" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      <svg className="code__done-icon" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="code__status" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

function Verdict({ tone, title, children }: { tone: "good" | "work" | "bad"; title: string; children: ReactNode }) {
  return (
    <div className={`checker__verdict checker__verdict--${tone}`} role="status">
      <p className="checker__verdict-title">{title}</p>
      {children}
    </div>
  );
}

function Strip({ analysis }: { analysis: Analysis }) {
  const { keyframes, duration, maxGap } = analysis;
  const shown = keyframes.length > 600 ? keyframes.filter((_, i) => i % Math.ceil(keyframes.length / 600) === 0) : keyframes;
  const note = `${keyframes.length} keyframe${keyframes.length === 1 ? "" : "s"} in ${clock(duration)}; the largest gap is ${maxGap.toFixed(2)} s.`;
  return (
    <figure className="keyframes checker__strip">
      <figcaption className="keyframes__label">Keyframes in your file</figcaption>
      <div className="keyframes__track" role="img" aria-label={note}>
        {shown.map((t, i) => (
          <span key={i} className="keyframes__tick" style={{ left: `${(t / duration) * 100}%` }} />
        ))}
      </div>
      <p className="keyframes__note">{note} vidscroll uses a file as it is when keyframes are at most {GAP_LIMIT} s apart.</p>
    </figure>
  );
}

function Result({ state, reset }: { state: Extract<State, { phase: "done" }>; reset: () => void }) {
  const { analysis: a, seeks, error } = state;
  const smooth = a != null && a.maxGap <= GAP_LIMIT;
  const canReencode = typeof window !== "undefined" && "VideoEncoder" in window;
  const framesPerSecond = seeks.playable && seeks.median > 0 ? Math.min(60, Math.round(1000 / seeks.median)) : 0;

  let verdict: ReactNode;
  if (!seeks.playable && !a) {
    verdict = (
      <Verdict tone="bad" title="This doesn't look like a video">
        <p>Neither vidscroll's reader nor this browser could open it. {error}</p>
      </Verdict>
    );
  } else if (!seeks.playable) {
    verdict = (
      <Verdict tone="bad" title="This browser can't play this file">
        <p>
          {a ? `Its codec is ${codecName(a.codec)}. ` : ""}Prepare it with the CLI below: it writes an H.264 MP4,
          which plays in every browser.
        </p>
      </Verdict>
    );
  } else if (!a) {
    verdict = (
      <Verdict tone="work" title="Couldn't read the file's keyframes">
        <p>
          {error} The browser can play it, but vidscroll can't tell how far apart its keyframes are, so it will
          re-encode it on the first visit. Preparing it with the CLI avoids that.
        </p>
      </Verdict>
    );
  } else if (smooth) {
    verdict = (
      <Verdict tone="good" title="Scrubs smoothly as it is">
        <p>Its keyframes are close enough together, so vidscroll uses the file as it is. No preparation needed.</p>
      </Verdict>
    );
  } else {
    verdict = (
      <Verdict tone="work" title="Slow to scrub until it's re-encoded">
        <p>
          Keyframes are up to {a.maxGap.toFixed(1)} s apart. vidscroll will re-encode it in each visitor's browser on
          their first visit and cache the result, or you can prepare it once with the command below.
          {!canReencode && " This browser can't re-encode videos (no WebCodecs), so here it would stay slow."}
        </p>
      </Verdict>
    );
  }

  const showCommand = a ? !smooth || !seeks.playable : seeks.playable;

  const warnings: string[] = [];
  if (a && a.duration > LONG_VIDEO_S)
    warnings.push(`It's ${clock(a.duration)} long. Scroll videos work best under about 2 minutes: longer ones mean very long pages and slow first loads.`);
  if (state.file.size > LARGE_FILE_BYTES)
    warnings.push(`It's ${megabytes(state.file.size)}. Every visitor downloads the whole file before scrolling starts.`);
  if (a?.hasAudio) warnings.push("It has an audio track. Audio never plays while scrubbing, and preparing the file drops it.");

  return (
    <div className="checker__result">
      {verdict}
      {a && <Strip analysis={a} />}
      {seeks.playable && (
        <div className="checker__seeks">
          <p className="checker__seeks-title">Seek test on this device</p>
          <p>
            Median <strong>{Math.round(seeks.median)} ms</strong>, worst <strong>{Math.round(seeks.worst)} ms</strong>{" "}
            over 20 jumps. That's about <strong>{framesPerSecond}</strong> new frame{framesPerSecond === 1 ? "" : "s"} per
            second while scrolling{framesPerSecond >= 30 ? ", which looks smooth" : ""}.
          </p>
        </div>
      )}
      {a && (
        <dl className="checker__facts">
          <div><dt>File</dt><dd>{a.name}</dd></div>
          <div><dt>Size</dt><dd>{megabytes(a.size)}</dd></div>
          <div><dt>Container</dt><dd>{a.container}</dd></div>
          <div><dt>Video codec</dt><dd>{codecName(a.codec)}{a.codecString ? <code>{a.codecString}</code> : null}</dd></div>
          <div><dt>Resolution</dt><dd>{a.width}×{a.height}</dd></div>
          <div><dt>Frame rate</dt><dd>{a.fps ? `${Math.round(a.fps * 100) / 100} fps` : "Unknown"}</dd></div>
          <div><dt>Duration</dt><dd>{clock(a.duration)}</dd></div>
          <div><dt>Audio</dt><dd>{a.hasAudio ? "Yes" : "No"}</dd></div>
        </dl>
      )}
      {showCommand ? (
        <div className="checker__prepare">
          <p className="checker__heading">Prepare it</p>
          <div className="code code--terminal">
            <div className="code__head">
              <span className="code__file">Terminal</span>
              <CopyCommand text={a ? commandFor(a).split("\n")[0] : `npx vidscroll encode ${quote(state.file.name)}`} />
            </div>
            <pre><code>{a ? commandFor(a) : `npx vidscroll encode ${quote(state.file.name)}`}</code></pre>
          </div>
        </div>
      ) : null}
      {warnings.length > 0 && (
        <ul className="checker__warnings">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <button type="button" className="checker__again" onClick={reset}>Check another file</button>
    </div>
  );
}

export function VideoChecker() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);

  const check = async (file: File) => {
    setState({ phase: "working", name: file.name, step: "Reading keyframes" });
    let analysis: Analysis | null = null;
    let error: string | null = null;
    try {
      analysis = await analyzeFile(file);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    setState({ phase: "working", name: file.name, step: "Measuring seeks on this device" });
    const seeks = await measureSeeks(file, analysis?.duration ?? 0).catch(() => ({ playable: false, median: 0, worst: 0 }));
    setState({ phase: "done", file, analysis, seeks, error });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void check(file);
  };

  if (state.phase === "done") {
    return (
      <div className="checker">
        <Result state={state} reset={() => setState({ phase: "idle" })} />
      </div>
    );
  }

  return (
    <div className="checker">
      <label
        className={`checker__drop${dragging ? " is-dragging" : ""}${state.phase === "working" ? " is-working" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv"
          className="checker__input"
          disabled={state.phase === "working"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void check(file);
            event.target.value = "";
          }}
        />
        {state.phase === "working" ? (
          <span className="checker__status" aria-live="polite">
            <span className="checker__title">{state.step}…</span>
            <span className="checker__hint">{state.name}</span>
          </span>
        ) : (
          <span className="checker__status">
            <span className="checker__title">Drop a video here, or choose a file</span>
            <span className="checker__hint">MP4, WebM or MOV. It's read in your browser; nothing is uploaded.</span>
          </span>
        )}
      </label>
    </div>
  );
}
