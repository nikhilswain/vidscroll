import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { easing } from "vidscroll";
import { invertEasing, withTail } from "../../../../src/core/easing";
import { highlight } from "../../../../demo/src/highlight";
import {
  DEFAULT_CONFIG,
  DEFAULT_SMOOTHING,
  EASING_NAMES,
  PRESETS,
  VIDEOS,
  decodeConfig,
  encodeConfig,
  htmlCode,
  reactCode,
  sectionId,
} from "./config";
import type { Config, FrameConfig, SectionConfig } from "./config";
import type { FrameState } from "./PlaygroundFrame";
import "../../styles/playground.css";

interface Props {
  base: string;
  version: string;
}

const EMPTY_STATE: FrameState = { type: "pg-state", progress: 0, time: 0, frame: 0, duration: 0, active: [], ready: false, auto: false };

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

const clock = (seconds: number) => {
  const tenths = Math.round(seconds * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
};

const curvePath = (fn: (t: number) => number, w: number, h: number, pad = 2) =>
  Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return `${i === 0 ? "M" : "L"}${(pad + t * (w - pad * 2)).toFixed(1)} ${(h - pad - fn(t) * (h - pad * 2)).toFixed(1)}`;
  }).join(" ");

function Segmented<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={o.value} className="segmented__item">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true"><span className="switch__thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="pg-field">
      <legend>{label}</legend>
      {children}
      {hint && <p className="pg-hint">{hint}</p>}
    </fieldset>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pg-copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Controls({ config, update, fileName, onFile, progress }: { config: Config; update: (patch: Partial<Config>) => void; fileName: string | null; onFile: (file: File) => void; progress: number }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const setSection = (id: string, patch: Partial<SectionConfig>) =>
    update({ sections: config.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const smoothing = config.smoothing ?? DEFAULT_SMOOTHING(config.smoothScroll);

  return (
    <div className="pg-controls">
      <Field label="Start from">
        <div className="pg-presets">
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="pg-preset" title={p.description} onClick={() => update(p.make())}>
              {p.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="video" hint={config.video === "file" ? `${fileName}: stays in your browser, nothing is uploaded.` : VIDEOS[config.video].note}>
        <div className="segmented" role="radiogroup" aria-label="video">
          {(["train", "cat"] as const).map((v) => (
            <label key={v} className="segmented__item">
              <input type="radio" name="video" checked={config.video === v} onChange={() => update({ video: v })} />
              <span>{VIDEOS[v].label}</span>
            </label>
          ))}
          <label className="segmented__item">
            <input type="radio" name="video" checked={config.video === "file"} onChange={() => (fileName ? update({ video: "file" }) : fileInput.current?.click())} />
            <span>{fileName ? "Your file" : "Your file…"}</span>
          </label>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="video/*,.mp4,.webm,.mov"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        {fileName && (
          <button type="button" className="pg-link" onClick={() => fileInput.current?.click()}>
            Choose another file
          </button>
        )}
      </Field>

      <Field label="length" hint={`${(config.length / 100).toFixed(1)} screens of scrolling play the whole video.`}>
        <div className="pg-range">
          <input type="range" min={150} max={2000} step={50} value={config.length} onChange={(e) => update({ length: Number(e.target.value) })} aria-label="length in vh" />
          <output>{config.length}vh</output>
        </div>
      </Field>

      <Field label="easing" hint="Scroll position (across) to video time (up).">
        <svg className="pg-curve" viewBox="0 0 240 96" aria-hidden="true">
          <path d="M2 94 L238 2" className="pg-curve__linear" />
          <path d={curvePath(easing[config.easing], 240, 96)} className="pg-curve__line" />
          <circle cx={2 + progress * 236} cy={94 - easing[config.easing](progress) * 92} r="4" className="pg-curve__dot" />
        </svg>
        <div className="pg-easings" role="radiogroup" aria-label="easing">
          {EASING_NAMES.map((name) => (
            <label key={name} className="chip">
              <input type="radio" name="easing" checked={config.easing === name} onChange={() => update({ easing: name })} />
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <path d={curvePath(easing[name], 20, 14)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{name}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="pg-row">
        <Field label="fit">
          <Segmented name="fit" value={config.fit} options={[{ value: "cover", label: "cover" }, { value: "contain", label: "contain" }]} onChange={(fit) => update({ fit })} />
        </Field>
        <Field label="optimize">
          <Segmented
            name="optimize"
            value={config.optimize}
            options={[{ value: "on", label: "on" }, { value: "wait", label: "wait" }, { value: "off", label: "off" }]}
            onChange={(optimize) => update({ optimize })}
          />
        </Field>
      </div>

      <Field label="scrolling">
        <Switch label="smoothScroll" checked={config.smoothScroll} onChange={(smoothScroll) => update({ smoothScroll })} />
        <div className="pg-range">
          <input type="range" min={10} max={300} step={5} value={smoothing} onChange={(e) => update({ smoothing: Number(e.target.value) })} aria-label="smoothingTauMs" />
          <output>{smoothing} ms</output>
        </div>
        <p className="pg-hint">
          smoothingTauMs: how closely the video follows the scroll.{" "}
          {config.smoothing != null && (
            <button type="button" className="pg-link" onClick={() => update({ smoothing: null })}>
              Reset to default
            </button>
          )}
        </p>
      </Field>

      <Field label="sections">
        <ul className="pg-sections">
          {config.sections.map((s) => (
            <li key={s.id} className="pg-section-row">
              <input className="pg-text" value={s.text} onChange={(e) => setSection(s.id, { text: e.target.value })} aria-label="Section text" />
              <div className="pg-section-range">
                <Segmented
                  name={`unit-${s.id}`}
                  value={s.unit}
                  options={[{ value: "scroll", label: "scroll" }, { value: "time", label: "seconds" }]}
                  onChange={(unit) => setSection(s.id, unit === "scroll" ? { unit, from: 0, to: 0.3 } : { unit, from: 0, to: 5 })}
                />
                <input type="number" className="pg-number" step={s.unit === "time" ? 0.5 : 0.05} min={0} value={s.from} onChange={(e) => setSection(s.id, { from: Number(e.target.value) })} aria-label="From" />
                <span aria-hidden="true">to</span>
                <input type="number" className="pg-number" step={s.unit === "time" ? 0.5 : 0.05} min={0} value={s.to} onChange={(e) => setSection(s.id, { to: Number(e.target.value) })} aria-label="To" />
                <button type="button" className="pg-remove" aria-label="Remove section" onClick={() => update({ sections: config.sections.filter((x) => x.id !== s.id) })}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="pg-add"
          onClick={() => {
            const from = Math.round(clamp(progress, 0, 0.8) * 100) / 100;
            update({ sections: [...config.sections, { id: sectionId(), text: "New section", unit: "scroll", from, to: Math.min(1, from + 0.2) }] });
          }}
        >
          + Add section here
        </button>
        <p className="pg-hint">Drag the bars under the preview to move them, or their ends to resize.</p>
      </Field>
    </div>
  );
}

function Timeline({ config, state, update, seek, auto, setAuto }: { config: Config; state: FrameState; update: (patch: Partial<Config>) => void; seek: (p: number) => void; auto: boolean; setAuto: (on: boolean) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const fn = withTail(easing[config.easing]);
  const toProgress = (s: SectionConfig, value: number) => (s.unit === "time" ? (state.duration ? invertEasing(fn, clamp(value / state.duration)) : -1) : value);
  const fromProgress = (s: SectionConfig, p: number) => (s.unit === "time" ? Math.round(fn(clamp(p)) * state.duration * 10) / 10 : Math.round(clamp(p) * 100) / 100);
  const at = (event: { clientX: number }) => {
    const rect = track.current!.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width);
  };

  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".pg-bar")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    seek(at(event));
    const move = (e: PointerEvent) => seek(at(e));
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  };

  const drag = (event: ReactPointerEvent<HTMLElement>, s: SectionConfig, mode: "start" | "end" | "move") => {
    event.preventDefault();
    event.stopPropagation();
    const startP = toProgress(s, s.from);
    const endP = toProgress(s, s.to);
    const origin = at(event);
    const move = (e: PointerEvent) => {
      const delta = at(e) - origin;
      let a = startP;
      let b = endP;
      if (mode === "start") a = clamp(startP + delta, 0, endP - 0.01);
      if (mode === "end") b = clamp(endP + delta, startP + 0.01, 1);
      if (mode === "move") {
        const d = clamp(delta, -startP, 1 - endP);
        a = startP + d;
        b = endP + d;
      }
      update({ sections: config.sections.map((x) => (x.id === s.id ? { ...x, from: fromProgress(s, a), to: fromProgress(s, b) } : x)) });
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  };

  return (
    <div className="pg-timeline">
      <div className="pg-timeline__bar">
        <button type="button" className="pg-play" onClick={() => setAuto(!auto)} aria-pressed={auto}>
          {auto ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" fill="currentColor" /><rect x="7" y="1.5" width="3" height="9" fill="currentColor" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" /></svg>
          )}
          {auto ? "Stop" : "Auto-scroll"}
        </button>
        <output className="pg-readout">
          {state.ready ? (
            <>
              <b>{clock(state.time)}</b> / {clock(state.duration)}<span className="pg-readout__frame"> · frame {state.frame}</span> · {Math.round(state.progress * 100)}% scrolled
            </>
          ) : (
            "Loading the video…"
          )}
        </output>
      </div>
      <div className="pg-timeline__area" ref={track} onPointerDown={scrub}>
        <div className="pg-lanes">
          {config.sections.map((s) => {
            const a = toProgress(s, s.from);
            const b = toProgress(s, s.to);
            if (a < 0 || b < 0) return null;
            return (
              <div
                key={s.id}
                className="pg-bar"
                data-active={state.active.includes(s.id) || undefined}
                style={{ left: `${a * 100}%`, width: `${Math.max(b - a, 0) * 100}%` }}
                onPointerDown={(e) => drag(e, s, "move")}
              >
                <span className="pg-bar__handle pg-bar__handle--start" onPointerDown={(e) => drag(e, s, "start")} />
                <span className="pg-bar__label">{s.text}</span>
                <span className="pg-bar__handle pg-bar__handle--end" onPointerDown={(e) => drag(e, s, "end")} />
              </div>
            );
          })}
        </div>
        <div className="pg-track">
          <div className="pg-track__fill" style={{ width: `${state.progress * 100}%` }} />
          <div className="pg-track__head" style={{ left: `${state.progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function CodePanel({ config, codeSrc, version }: { config: Config; codeSrc: string; version: string }) {
  const [lang, setLang] = useState<"react" | "html">("react");
  const code = useMemo(() => (lang === "react" ? reactCode(config, codeSrc) : htmlCode(config, codeSrc, version)), [lang, config, codeSrc, version]);
  return (
    <div className="pg-code">
      <div className="pg-code__head">
        <div className="pg-tabs" role="tablist" aria-label="Code language">
          {(["react", "html"] as const).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={lang === l} className="pg-tab" onClick={() => setLang(l)}>
              {l === "react" ? "React" : "HTML"}
            </button>
          ))}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="pg-code__body"><code>{highlight(code)}</code></pre>
      <p className="pg-code__note">
        {lang === "react" ? (
          <>
            Install with <code>npm i vidscroll</code>, then replace <code>{codeSrc}</code> with your video.
          </>
        ) : (
          <>
            No build step: the script tag loads the element from a CDN. Replace <code>{codeSrc}</code> with your video.
          </>
        )}
      </p>
    </div>
  );
}

export function Playground({ base, version }: Props) {
  const [config, setConfig] = useState<Config>(() => (typeof location !== "undefined" && decodeConfig(location.hash.slice(1))) || DEFAULT_CONFIG());
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [state, setState] = useState<FrameState>(EMPTY_STATE);
  const [auto, setAutoState] = useState(false);
  const [panel, setPanel] = useState<"controls" | "code">("controls");
  const frame = useRef<HTMLIFrameElement>(null);

  const update = useCallback((patch: Partial<Config>) => setConfig((c) => ({ ...c, ...patch })), []);

  const src = config.video === "file" && file ? file.url : `${base}${VIDEOS[config.video === "file" ? "train" : config.video].file}`;
  const codeSrc = config.video === "file" && file ? `/videos/${file.name}` : "/videos/hero.mp4";

  const frameConfig: FrameConfig = useMemo(
    () => ({
      length: config.length,
      easing: config.easing,
      fit: config.fit,
      smoothScroll: config.smoothScroll,
      smoothing: config.smoothing,
      optimize: config.optimize,
      sections: config.sections,
      src,
    }),
    [config, src]
  );

  const frameConfigRef = useRef(frameConfig);
  frameConfigRef.current = frameConfig;

  const send = useCallback((message: object) => frame.current?.contentWindow?.postMessage(message, location.origin), []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "pg-ready") send({ type: "pg-config", config: frameConfigRef.current });
      if (event.data?.type === "pg-state") setState(event.data);
      if (event.data?.type === "pg-auto-off") setAutoState(false);
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [send]);

  useEffect(() => {
    send({ type: "pg-config", config: frameConfig });
  }, [frameConfig, send]);

  useEffect(() => {
    const id = setTimeout(() => history.replaceState(null, "", `#${encodeConfig(config)}`), 300);
    return () => clearTimeout(id);
  }, [config]);

  const setAuto = (on: boolean) => {
    setAutoState(on);
    send({ type: "pg-auto", on });
  };

  const onFile = (f: File) => {
    if (file) URL.revokeObjectURL(file.url);
    setFile({ url: URL.createObjectURL(f), name: f.name });
    update({ video: "file" });
  };

  const controls = <Controls config={config} update={update} fileName={file?.name ?? null} onFile={onFile} progress={state.progress} />;
  const code = <CodePanel config={config} codeSrc={codeSrc} version={version} />;

  return (
    <div className="pg" data-panel={panel}>
      <aside className="pg-side" aria-label="Settings">
        <div className="pg-switcher" role="tablist" aria-label="Panel">
          <button type="button" role="tab" aria-selected={panel === "controls"} className="pg-tab" onClick={() => setPanel("controls")}>
            Controls
          </button>
          <button type="button" role="tab" aria-selected={panel === "code"} className="pg-tab" onClick={() => setPanel("code")}>
            Code
          </button>
        </div>
        <div className="pg-side__controls">{controls}</div>
        <div className="pg-side__code">{code}</div>
      </aside>
      <section className="pg-preview" aria-label="Preview">
        <iframe ref={frame} className="pg-frame" src={`${base}playground/frame/`} title="Playground preview: scroll inside to scrub" />
        <Timeline config={config} state={state} update={update} seek={(p) => send({ type: "pg-seek", progress: p })} auto={auto} setAuto={setAuto} />
      </section>
      <aside className="pg-code-col" aria-label="Code">
        {code}
      </aside>
    </div>
  );
}
