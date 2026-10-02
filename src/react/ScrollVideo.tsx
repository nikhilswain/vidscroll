import React, { useEffect, useRef, useState, useId, useMemo } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { createEngine } from "../core/engine";
import { loadScrollVideo } from "../core/load";
import type { LoadedVideo, OptimizeOptions } from "../core/load";
import { createSmoothScroll } from "../core/smoothScroll";
import type { SmoothScrollOptions } from "../core/smoothScroll";
import type { EngineAPI, EngineOptions, SectionDescriptor } from "../core/types";
import { ScrollVideoContext, useScrollVideo } from "./context";

export interface LoaderState {
  phase: "download" | "optimize" | "preparing" | "error";
  /** 0..1 within the current phase. */
  progress: number;
  error?: Error;
}

export interface ScrollVideoProps extends Omit<EngineOptions, "video" | "spacer"> {
  /**
   * URL of a video file (.mp4/.webm/.mov) — not a YouTube/Vimeo page.
   * Cross-origin files need CORS headers to be optimized.
   */
  src: string;
  /**
   * Re-encode videos whose keyframes are too far apart for smooth scrubbing,
   * in the browser, on first load (cached afterwards). Default true.
   * Pre-encoding with `npx vidscroll encode` avoids the wait entirely.
   */
  optimize?: boolean | OptimizeOptions;
  /** Lerped wheel scrolling for buttery input. */
  smoothScroll?: boolean | SmoothScrollOptions;
  /**
   * Download the whole file before scrolling is enabled (default true).
   * `false` streams the URL directly and skips optimization.
   */
  fullPreload?: boolean;
  /**
   * Loading overlay: `false` disables it, a node replaces it, a function
   * renders it from the current phase/progress.
   */
  loader?: ReactNode | false | ((state: LoaderState) => ReactNode);
  /** Called once the video is loaded, with how it's being served. */
  onLoad?: (info: Pick<LoadedVideo, "source" | "probe">) => void;
  onError?: (error: Error) => void;
  sectionDisplayMode?: "layered" | "exclusive" | "crossfade";
  crossfadeDurationMs?: number; // used in crossfade mode
}

const PHASE_LABEL: Record<Exclude<LoaderState["phase"], "error">, string> = {
  download: "Loading video",
  optimize: "Optimizing video",
  preparing: "Preparing",
};

function DefaultLoader({ phase, progress, error }: LoaderState) {
  if (error) {
    return (
      <div style={{ maxWidth: 520, padding: 24, fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
        {error.message}
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 220,
          height: 4,
          background: "rgba(255,255,255,0.15)",
          borderRadius: 999,
          overflow: "hidden",
          margin: "0 auto 12px",
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
      <div
        style={{
          fontSize: 13,
          opacity: 0.7,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {`${PHASE_LABEL[phase as keyof typeof PHASE_LABEL]} ${Math.round(progress * 100)}%`}
      </div>
    </div>
  );
}

export function ScrollVideo({
  src,
  optimize,
  fps,
  pixelsPerFrame,
  bufferFrames,
  easing,
  scrollTarget,
  minScrollHeight,
  smoothingTauMs,
  warmup,
  smoothScroll,
  fullPreload = true,
  loader,
  onLoad,
  onError,
  debug,
  onDebug,
  children,
  sectionDisplayMode = "layered",
  crossfadeDurationMs = 500,
}: PropsWithChildren<ScrollVideoProps>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const [api, setApi] = useState<EngineAPI | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoaderState | null>({
    phase: "download",
    progress: 0,
  });

  // Options live in a ref so inline objects/callbacks don't restart loading
  // or tear the engine down every render.
  const optionsRef = useRef({
    fps,
    pixelsPerFrame,
    bufferFrames,
    easing,
    scrollTarget,
    minScrollHeight,
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
    fps,
    pixelsPerFrame,
    bufferFrames,
    easing,
    scrollTarget,
    minScrollHeight,
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

  // Lerped wheel scrolling; the engine just reads the animated scrollY.
  useEffect(() => {
    if (!smoothOn) return;
    const o = optionsRef.current.smoothScroll;
    const instance = createSmoothScroll(o && o !== true ? o : undefined);
    return () => instance.destroy();
  }, [smoothOn]);

  // Load: download → (re-encode if needed) → hand the URL to the <video>.
  useEffect(() => {
    const controller = new AbortController();
    let loaded: LoadedVideo | null = null;
    setVideoUrl(null);
    setLoading({ phase: "download", progress: 0 });

    const finish = (result: LoadedVideo) => {
      loaded = result;
      setVideoUrl(result.url);
      setLoading({ phase: "preparing", progress: 0 });
      optionsRef.current.onLoad?.({ source: result.source, probe: result.probe });
    };

    if (!fullPreload) {
      finish({ url: src, source: "stream", probe: null, release() {} });
    } else {
      loadScrollVideo(src, {
        optimize: optionsRef.current.optimize,
        signal: controller.signal,
        onProgress: (phase, progress) => {
          if (!controller.signal.aborted) setLoading({ phase, progress });
        },
      }).then(
        (result) => {
          if (controller.signal.aborted) result.release();
          else finish(result);
        },
        (err: Error) => {
          if (controller.signal.aborted) return;
          console.error(err);
          setLoading({ phase: "error", progress: 0, error: err });
          optionsRef.current.onError?.(err);
        }
      );
    }

    return () => {
      controller.abort();
      loaded?.release();
    };
  }, [src, fullPreload]);

  useEffect(() => {
    const video = videoRef.current;
    const spacer = spacerRef.current;
    if (!video || !spacer || !videoUrl) return;
    const o = optionsRef.current;

    const engine = createEngine({
      video,
      spacer,
      fps: o.fps,
      pixelsPerFrame: o.pixelsPerFrame,
      bufferFrames: o.bufferFrames,
      easing: o.easing,
      scrollTarget: o.scrollTarget,
      minScrollHeight: o.minScrollHeight,
      smoothingTauMs: o.smoothingTauMs ?? (smoothOn ? 35 : undefined),
      warmup: o.warmup,
      debug: o.debug,
      onDebug: o.onDebug,
    });
    setApi(engine);
    return () => {
      setApi(null);
      engine.destroy();
    };
  }, [videoUrl, smoothOn]);

  // Loader progress for the preparing phase (decoder warm-up), plus a safety
  // sync in case "ready" fired before this subscription existed.
  useEffect(() => {
    if (!api) return;
    const onWarmup = (p: { value: number }) =>
      setLoading({ phase: "preparing", progress: p.value });
    const onReady = () => setLoading(null);
    api.on("warmup", onWarmup);
    api.on("ready", onReady);
    if (api.isReady()) setLoading(null);
    return () => {
      api.off("warmup", onWarmup);
      api.off("ready", onReady);
    };
  }, [api]);

  // Lock scrolling while loading so users can't scrub a cold video.
  const locked = loading != null && loading.phase !== "error";
  useEffect(() => {
    if (!locked) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);

  const contextValue = useMemo(
    () => ({ api, sectionDisplayMode, crossfadeDurationMs }),
    [api, sectionDisplayMode, crossfadeDurationMs]
  );

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          muted
          playsInline
          preload="auto"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {children}
        </div>
      </div>
      <div ref={spacerRef} />
      {loading && loader !== false && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            background: "#000",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {typeof loader === "function"
            ? loader(loading)
            : loader != null
              ? loader
              : DefaultLoader(loading)}
        </div>
      )}
    </ScrollVideoContext.Provider>
  );
}

interface SectionProps extends Omit<SectionDescriptor, "id"> {
  id?: string; // allow auto id
  className?: string;
  as?: React.ElementType;
  children?: React.ReactNode;
  inactiveClassName?: string;
  activeClassName?: string;
}

export function Section({
  id,
  children,
  className,
  inactiveClassName,
  activeClassName,
  as = "div",
  ...rest
}: SectionProps) {
  const autoId = useId();
  const sectionId = id || autoId;
  const { api, sectionDisplayMode, crossfadeDurationMs } = useScrollVideo();
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef(0);

  // Subscribe before registering (effects run in order): registering emits
  // sectionEnter right away for a section that starts active.
  // Sections only re-render when they flip active state, not on every frame.
  useEffect(() => {
    if (!api) return;
    const handleEnter = (p: { id: string }) => {
      if (p.id !== sectionId) return;
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = 0;
      }
      setLeaving(false);
      setActive(true);
    };
    const handleExit = (p: { id: string }) => {
      if (p.id !== sectionId) return;
      setActive(false);
      if (sectionDisplayMode === "crossfade") {
        setLeaving(true);
        leaveTimerRef.current = window.setTimeout(() => {
          setLeaving(false);
          leaveTimerRef.current = 0;
        }, crossfadeDurationMs);
      } else {
        setLeaving(false);
      }
    };
    api.on("sectionEnter", handleEnter);
    api.on("sectionExit", handleExit);
    return () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = 0;
      }
      api.off("sectionEnter", handleEnter);
      api.off("sectionExit", handleExit);
    };
  }, [api, sectionId, sectionDisplayMode, crossfadeDurationMs]);

  // Register / unregister
  useEffect(() => {
    if (!api) return;
    const desc: SectionDescriptor = { id: sectionId, ...rest };
    api.registerSection(desc);
    return () => api.unregisterSection(sectionId);
    // Spread of rest stable enough for typical usage; if user passes new object each render it will re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, sectionId, JSON.stringify(rest)]);

  const Element: React.ElementType = as;
  const mergedClass = [className, active ? activeClassName : inactiveClassName]
    .filter(Boolean)
    .join(" ");

  // Visibility logic based on mode
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transition: "opacity 400ms ease",
  };
  if (sectionDisplayMode === "exclusive") {
    baseStyle.opacity = active ? 1 : 0;
    baseStyle.visibility = active ? "visible" : "hidden";
    baseStyle.pointerEvents = active ? "auto" : "none";
  } else if (sectionDisplayMode === "crossfade") {
    if (active) {
      baseStyle.opacity = 1;
      baseStyle.zIndex = 2;
      baseStyle.pointerEvents = "auto";
    } else if (leaving) {
      baseStyle.opacity = 0;
      baseStyle.zIndex = 1;
      baseStyle.pointerEvents = "none";
    } else {
      baseStyle.opacity = 0;
      baseStyle.visibility = "hidden";
      baseStyle.pointerEvents = "none";
    }
    baseStyle.transition = `opacity ${crossfadeDurationMs}ms ease`;
  } else {
    // layered
    baseStyle.opacity = active ? 1 : 0.12;
    baseStyle.pointerEvents = active ? "auto" : "none";
  }

  return (
    <Element
      data-scroll-video-section={sectionId}
      data-active={active ? "true" : "false"}
      className={mergedClass}
      style={baseStyle}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </Element>
  );
}
