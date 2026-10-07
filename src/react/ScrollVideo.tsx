import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { INITIAL_LOADER, LOADER_HINT, createScrollVideo, initialHeight, loaderLabel, previewSource } from "../core/controller";
import type { LoaderState, ScrollVideoController, ScrollVideoOptions } from "../core/controller";
import { ScrollVideoContext } from "./context";
import { BaseStyles } from "./styles";

export type { LoaderState } from "../core/controller";

export interface ScrollVideoProps extends ScrollVideoOptions {
  loader?: ReactNode | false | ((state: LoaderState, builtIn: ReactNode) => ReactNode);
  className?: string;
  style?: CSSProperties;
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

function DefaultLoader(state: LoaderState) {
  const { progress, background, error } = state;
  if (error) {
    return (
      <div style={{ maxWidth: 520, padding: 24, fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
        {error.message}
      </div>
    );
  }
  const label = loaderLabel(state);
  if (background) {
    return (
      <div
        title={LOADER_HINT}
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

function InitialMedia({ src, fit = "cover", poster, fullPreload = true }: ScrollVideoOptions) {
  const previewSrc = previewSource(src);
  return (
    <>
      <video data-vidscroll-media="" data-fit={fit} poster={poster || undefined} muted playsInline preload="auto" />
      {poster === undefined && fullPreload && previewSrc != null && (
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
    </>
  );
}

export function ScrollVideo({
  loader,
  className,
  style,
  children,
  ...options
}: PropsWithChildren<ScrollVideoProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [api, setApi] = useState<ScrollVideoController | null>(null);
  const [loading, setLoading] = useState<LoaderState | null>(INITIAL_LOADER);
  const [media] = useState(() => InitialMedia(options));

  useEffect(() => {
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;
    const controller = createScrollVideo({ container, stage }, optionsRef.current);
    setApi(controller);
    setLoading(controller.getLoader());
    controller.on("loader", setLoading);
    return () => {
      controller.destroy();
      setApi(null);
    };
  }, []);

  useEffect(() => {
    api?.setOptions(options);
  });

  const contextValue = useMemo(() => ({ api }), [api]);

  const loaderContent = !loading
    ? null
    : typeof loader === "function"
      ? loader(loading, DefaultLoader(loading))
      : loader == null || loading.phase === "error"
        ? DefaultLoader(loading)
        : loading.background
          ? null
          : loader;

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <BaseStyles />
      <div ref={containerRef} data-vidscroll="" className={className} style={{ height: initialHeight(options.length), ...style }}>
        <div ref={stageRef} data-vidscroll-stage="">
          {media}
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
