import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { createEngine } from "../core/engine";
import { loadScrollVideo } from "../core/load";
import { VidscrollError, checkSourceUrl, warnOnce } from "../core/source";
import type { LoadedVideo, OptimizeOptions } from "../core/load";
import { acquireSmoothScroll } from "../core/smoothScroll";
import type { SmoothScrollOptions } from "../core/smoothScroll";
import type { EngineAPI, EngineOptions } from "../core/types";
import { ScrollVideoContext } from "./context";
import { BaseStyles } from "./styles";

export interface LoaderState {
  phase: "download" | "optimize" | "preparing" | "error";
  progress: number;
  error?: Error;
}

export interface ScrollVideoProps
  extends Omit<EngineOptions, "video" | "frames" | "container" | "stage"> {
  src: string;
  optimize?: boolean | OptimizeOptions;
  smoothScroll?: boolean | SmoothScrollOptions;
  fullPreload?: boolean;
  loader?: ReactNode | false | ((state: LoaderState) => ReactNode);
  onLoad?: (info: Pick<LoadedVideo, "source" | "probe">) => void;
  onError?: (error: Error) => void;
  fit?: "cover" | "contain";
  poster?: string | false;
  className?: string;
  style?: CSSProperties;
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
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {`${PHASE_LABEL[phase as keyof typeof PHASE_LABEL]} ${Math.round(progress * 100)}%`}
      </div>
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
  const [api, setApi] = useState<EngineAPI | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState<LoaderState | null>({
    phase: "download",
    progress: 0,
  });

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
    let loaded: LoadedVideo | null = null;
    setVideoUrl(null);
    setLoading({ phase: "download", progress: 0 });

    const finish = (result: LoadedVideo) => {
      loaded = result;
      releaseRef.current = () => result.release();
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
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!video || !container || !stage || !videoUrl) return;
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
      debug: o.debug,
      onDebug: o.onDebug,
    });
    setApi(engine);
    return () => {
      setApi(null);
      engine.destroy();
    };
  }, [videoUrl, smoothOn, lengthKey]);

  useEffect(() => {
    if (!api) return;
    const notFailed = (next: LoaderState | null) => (current: LoaderState | null) =>
      current?.phase === "error" ? current : next;
    const onWarmup = (p: { value: number }) =>
      setLoading(notFailed({ phase: "preparing", progress: p.value }));
    const onReady = () => setLoading(notFailed(null));
    api.on("warmup", onWarmup);
    api.on("ready", onReady);
    if (api.isReady()) setLoading(notFailed(null));
    return () => {
      api.off("warmup", onWarmup);
      api.off("ready", onReady);
    };
  }, [api]);

  const contextValue = useMemo(() => ({ api }), [api]);

  const failPlayback = (reason: string) => {
    if (!videoUrl) return;
    if (videoUrl !== src) {
      warnOnce(`[vidscroll] This browser couldn't use the downloaded copy of "${src}" (${reason}); streaming it instead.`);
      releaseRef.current?.();
      releaseRef.current = null;
      setVideoUrl(src);
      return;
    }
    const err = new VidscrollError(
      "unplayable",
      `[vidscroll] This browser can't scrub "${src}" (${reason}). Preparing it with \`npx vidscroll encode\` produces a standard MP4 that plays everywhere.`
    );
    console.error(err);
    setLoading({ phase: "error", progress: 0, error: err });
    optionsRef.current.onError?.(err);
  };

  const onVideoError = () =>
    failPlayback(videoRef.current?.error?.message || "unsupported format or codec");

  const onVideoMetadata = () => {
    const duration = videoRef.current?.duration ?? 0;
    if (!(duration > 0 && Number.isFinite(duration))) failPlayback("its duration is unknown, so it can't seek");
  };

  const previewSrc = useMemo(() => {
    try {
      checkSourceUrl(src);
    } catch {
      return null;
    }
    return src.includes("#") ? src : `${src}#t=0.001`;
  }, [src]);
  const showPreview =
    poster === undefined && fullPreload && previewSrc != null && loading != null && loading.phase !== "error";

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <BaseStyles />
      <div ref={containerRef} data-vidscroll="" className={className} style={style}>
        <div ref={stageRef} data-vidscroll-stage="">
          <video
            ref={videoRef}
            data-vidscroll-media=""
            data-fit={fit}
            src={videoUrl ?? undefined}
            poster={poster || undefined}
            onError={onVideoError}
            onLoadedMetadata={onVideoMetadata}
            muted
            playsInline
            preload="auto"
          />
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
          {loading && loader !== false && (
            <div data-vidscroll-loader="">
              {typeof loader === "function"
                ? loader(loading)
                : loader != null
                  ? loader
                  : DefaultLoader(loading)}
            </div>
          )}
        </div>
      </div>
    </ScrollVideoContext.Provider>
  );
}
