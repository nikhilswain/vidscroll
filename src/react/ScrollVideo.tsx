import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { createEngine } from "../core/engine";
import { loadScrollVideo } from "../core/load";
import { VidscrollError, checkSourceUrl, warnOnce } from "../core/source";
import type { LoadPhase, LoadedVideo, OptimizeOptions } from "../core/load";
import { acquireSmoothScroll } from "../core/smoothScroll";
import type { SmoothScrollOptions } from "../core/smoothScroll";
import type { EngineAPI, EngineOptions } from "../core/types";
import { ScrollVideoContext } from "./context";
import { useVideoProgressVariable } from "./hooks";
import { BaseStyles } from "./styles";

export interface LoaderState {
  phase: "download" | "optimize" | "preparing" | "error";
  progress: number;
  background: boolean;
  error?: Error;
}

export interface ScrollVideoProps
  extends Omit<EngineOptions, "video" | "frames" | "container" | "stage" | "preview"> {
  src: string;
  optimize?: boolean | OptimizeOptions;
  smoothScroll?: boolean | SmoothScrollOptions;
  fullPreload?: boolean;
  loader?: ReactNode | false | ((state: LoaderState, builtIn: ReactNode) => ReactNode);
  onLoad?: (info: Pick<LoadedVideo, "source" | "probe">) => void;
  onError?: (error: Error) => void;
  fit?: "cover" | "contain";
  poster?: string | false;
  className?: string;
  style?: CSSProperties;
}

interface Media {
  url: string;
  engineKey: number;
  preview: boolean;
  release: () => void;
}

interface Slots {
  active: Media | null;
  next: Media | null;
}

interface Pipeline {
  phase: LoadPhase;
  progress: number;
}

const EMPTY: Slots = { active: null, next: null };

const PHASE_LABEL: Record<Exclude<LoaderState["phase"], "error">, string> = {
  download: "Loading video",
  optimize: "Optimizing video",
  preparing: "Preparing",
};

function loaderState(
  error: Error | null,
  hasVideo: boolean,
  ready: boolean,
  warmup: number,
  pipeline: Pipeline | null,
  swapping: boolean
): LoaderState | null {
  if (error) return { phase: "error", progress: 0, background: false, error };
  if (!hasVideo) return { phase: pipeline?.phase ?? "download", progress: pipeline?.progress ?? 0, background: false };
  if (!ready) return { phase: "preparing", progress: warmup, background: false };
  if (pipeline) return { ...pipeline, background: true };
  if (swapping) return { phase: "optimize", progress: 1, background: true };
  return null;
}

function ProgressBar({ progress, width }: { progress: number; width: number }) {
  return (
    <div
      style={{
        width,
        height: 4,
        background: "rgba(255,255,255,0.15)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.round(progress * 100)}%`,
          height: "100%",
          background: "#fff",
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

function DefaultLoader({ phase, progress, background, error }: LoaderState) {
  if (error) {
    return (
      <div style={{ maxWidth: 520, padding: 24, fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
        {error.message}
      </div>
    );
  }
  const label = `${PHASE_LABEL[phase as keyof typeof PHASE_LABEL]} ${Math.round(progress * 100)}%`;
  if (background) {
    return (
      <div
        title="Scrubbing gets smoother once this finishes"
        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}
      >
        <ProgressBar progress={progress} width={56} />
        <span style={{ opacity: 0.8 }}>{label}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
      <ProgressBar progress={progress} width={220} />
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
    </div>
  );
}

export function ScrollVideo({
  src,
  optimize,
  length,
  fps,
  easing,
  smoothingTauMs,
  warmup,
  smoothScroll,
  fullPreload = true,
  loader,
  fit = "cover",
  poster,
  onLoad,
  onError,
  debug,
  onDebug,
  className,
  style,
  children,
}: PropsWithChildren<ScrollVideoProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextRef = useRef<HTMLVideoElement | null>(null);
  const engineKeyRef = useRef(0);
  const [api, setApi] = useState<EngineAPI | null>(null);
  const [slots, setSlots] = useState<Slots>(EMPTY);
  const [pipeline, setPipeline] = useState<Pipeline | null>({ phase: "download", progress: 0 });
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const [warmupProgress, setWarmupProgress] = useState(0);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const optionsRef = useRef({
    length,
    fps,
    easing,
    smoothingTauMs,
    warmup,
    smoothScroll,
    optimize,
    onLoad,
    onError,
    debug,
    onDebug,
  });
  optionsRef.current = {
    length,
    fps,
    easing,
    smoothingTauMs,
    warmup,
    smoothScroll,
    optimize,
    onLoad,
    onError,
    debug,
    onDebug,
  };

  const smoothOn = !!smoothScroll;
  const lengthKey = String(length ?? "auto");

  useEffect(() => {
    if (!smoothOn) return;
    const o = optionsRef.current.smoothScroll;
    return acquireSmoothScroll(o && o !== true ? o : undefined);
  }, [smoothOn]);

  useEffect(() => {
    const controller = new AbortController();
    const owned: LoadedVideo[] = [];
    const toMedia = (video: LoadedVideo, preview: boolean): Media => ({
      url: video.url,
      engineKey: ++engineKeyRef.current,
      preview,
      release: video.release,
    });
    const stream: LoadedVideo = { url: src, source: "stream", probe: null, release() {} };
    const reportLoad = (video: LoadedVideo) =>
      optionsRef.current.onLoad?.({ source: video.source, probe: video.probe });
    setSlots(EMPTY);
    setError(null);

    if (!fullPreload) {
      setPipeline(null);
      setSlots({ active: toMedia(stream, false), next: null });
      reportLoad(stream);
    } else {
      setPipeline({ phase: "download", progress: 0 });
      const optimizeOption = optionsRef.current.optimize;
      const wait = typeof optimizeOption === "object" && optimizeOption.wait === true;
      let preview: LoadedVideo | null = null;
      let shown: Pipeline = { phase: "download", progress: 0 };
      loadScrollVideo(src, {
        optimize: optimizeOption,
        signal: controller.signal,
        onProgress: (phase, progress) => {
          const rounded = Math.round(progress * 100) / 100;
          if (controller.signal.aborted || (phase === shown.phase && rounded === shown.progress)) return;
          shown = { phase, progress: rounded };
          setPipeline(shown);
        },
        onPreview: wait
          ? undefined
          : (original) => {
              preview = original;
              owned.push(original);
              setSlots({ active: toMedia(original, true), next: null });
            },
      }).then(
        (result) => {
          if (controller.signal.aborted) return result.release();
          setPipeline(null);
          reportLoad(result);
          if (result === preview) {
            const fallback = toMedia(stream, false);
            setSlots((s) => (s.active ? s : { active: fallback, next: null }));
            return;
          }
          owned.push(result);
          const media = toMedia(result, false);
          setSlots((s) => (s.active ? { active: s.active, next: media } : { active: media, next: null }));
        },
        (err: Error) => {
          if (controller.signal.aborted) return;
          console.error(err);
          setError(err);
          optionsRef.current.onError?.(err);
        }
      );
    }

    return () => {
      controller.abort();
      owned.forEach((video) => video.release());
    };
  }, [src, fullPreload]);

  const shownRef = useRef<Slots>(EMPTY);
  useEffect(() => {
    const previous = shownRef.current;
    shownRef.current = slots;
    const kept = [slots.active?.url, slots.next?.url];
    for (const media of [previous.active, previous.next]) {
      if (media && !kept.includes(media.url)) media.release();
    }
  }, [slots]);

  const activeKey = slots.active?.engineKey;
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const stage = stageRef.current;
    const media = slotsRef.current.active;
    if (!video || !container || !stage || !media) return;
    const o = optionsRef.current;

    const engine = createEngine({
      video,
      container,
      stage,
      length: o.length,
      fps: o.fps,
      easing: o.easing,
      smoothingTauMs: o.smoothingTauMs ?? (smoothOn ? 35 : undefined),
      warmup: o.warmup,
      preview: media.preview,
      debug: o.debug,
      onDebug: o.onDebug,
    });
    setApi(engine);
    return () => {
      setApi(null);
      engine.destroy();
    };
  }, [activeKey, smoothOn, lengthKey]);

  useEffect(() => {
    setReady(false);
    setWarmupProgress(0);
    if (!api) return;
    const onWarmup = (p: { value: number }) => setWarmupProgress(p.value);
    const onReady = () => setReady(true);
    api.on("warmup", onWarmup);
    api.on("ready", onReady);
    if (api.isReady()) setReady(true);
    return () => {
      api.off("warmup", onWarmup);
      api.off("ready", onReady);
    };
  }, [api]);

  const next = slots.next;
  useEffect(() => {
    const element = nextRef.current;
    if (!api || !ready || !next || !element) return;
    let cancelled = false;
    api.swapVideo(element).then(
      () => {
        if (cancelled) return;
        setSlots((s) =>
          s.next === next && s.active ? { active: { ...next, engineKey: s.active.engineKey }, next: null } : s
        );
      },
      (err: Error) => {
        if (cancelled) return;
        warnOnce(`[vidscroll] Couldn't switch to the optimized copy of "${src}" (${err.message}); keeping the original.`);
        setSlots((s) => (s.next === next ? { active: s.active, next: null } : s));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [api, ready, next, src]);

  useVideoProgressVariable(api, containerRef);
  const contextValue = useMemo(() => ({ api }), [api]);

  const failPlayback = (reason: string) => {
    const { active, next } = slots;
    if (!active) return;
    if (next) {
      setSlots({ active: { ...next, engineKey: ++engineKeyRef.current }, next: null });
      return;
    }
    if (active.preview && pipeline) {
      setSlots(EMPTY);
      return;
    }
    if (active.url !== src) {
      warnOnce(`[vidscroll] This browser couldn't use the downloaded copy of "${src}" (${reason}); streaming it instead.`);
      setSlots({
        active: { url: src, engineKey: ++engineKeyRef.current, preview: false, release() {} },
        next: null,
      });
      return;
    }
    const err = new VidscrollError(
      "unplayable",
      `[vidscroll] This browser can't scrub "${src}" (${reason}). Preparing it with \`npx vidscroll encode\` produces a standard MP4 that plays everywhere.`
    );
    console.error(err);
    setError(err);
    optionsRef.current.onError?.(err);
  };

  const onVideoError = () =>
    failPlayback(videoRef.current?.error?.message || "unsupported format or codec");

  const onVideoMetadata = () => {
    const duration = videoRef.current?.duration ?? 0;
    if (!(duration > 0 && Number.isFinite(duration))) failPlayback("its duration is unknown, so it can't seek");
  };

  const loading = loaderState(error, slots.active != null, ready, warmupProgress, pipeline, slots.next != null);
  const loaderContent = !loading
    ? null
    : typeof loader === "function"
      ? loader(loading, DefaultLoader(loading))
      : loader == null
        ? DefaultLoader(loading)
        : loading.background
          ? null
          : loader;

  const previewSrc = useMemo(() => {
    try {
      checkSourceUrl(src);
    } catch {
      return null;
    }
    return src.includes("#") ? src : `${src}#t=0.001`;
  }, [src]);
  const showPreview =
    poster === undefined &&
    fullPreload &&
    previewSrc != null &&
    loading != null &&
    !loading.background &&
    loading.phase !== "error";

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <BaseStyles />
      <div ref={containerRef} data-vidscroll="" className={className} style={style}>
        <div ref={stageRef} data-vidscroll-stage="">
          <video
            key={slots.active?.url ?? ""}
            ref={videoRef}
            data-vidscroll-media=""
            data-fit={fit}
            src={slots.active?.url}
            poster={poster || undefined}
            onError={onVideoError}
            onLoadedMetadata={onVideoMetadata}
            muted
            playsInline
            preload="auto"
          />
          {next && (
            <video
              key={next.url}
              ref={nextRef}
              data-vidscroll-media=""
              data-vidscroll-next=""
              data-fit={fit}
              src={next.url}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
            />
          )}
          {showPreview && (
            <video
              data-vidscroll-media=""
              data-vidscroll-preview=""
              data-fit={fit}
              src={previewSrc}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          )}
          <div data-vidscroll-overlay="">{children}</div>
          {loading && loaderContent != null && loaderContent !== false && (
            <div
              data-vidscroll-loader=""
              data-phase={loading.phase}
              data-background={loading.background ? "" : undefined}
            >
              {loaderContent}
            </div>
          )}
        </div>
      </div>
    </ScrollVideoContext.Provider>
  );
}
