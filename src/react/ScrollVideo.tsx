import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { INITIAL_LOADER, createScrollVideo, previewSource } from "../core/controller";
import type { LoaderState, ScrollVideoController, ScrollVideoOptions, ScrollVideoView } from "../core/controller";
import { ScrollVideoContext } from "./context";
import { BaseStyles } from "./styles";

export type { LoaderState } from "../core/controller";

export interface ScrollVideoProps extends ScrollVideoOptions {
  loader?: ReactNode | false | ((state: LoaderState, builtIn: ReactNode) => ReactNode);
  className?: string;
  style?: CSSProperties;
}

const INITIAL_VIEW: ScrollVideoView = { engine: null, loader: INITIAL_LOADER };

const PHASE_LABEL: Record<Exclude<LoaderState["phase"], "error">, string> = {
  download: "Loading video",
  optimize: "Optimizing video",
  preparing: "Preparing",
};

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
  const controllerRef = useRef<ScrollVideoController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [view, setView] = useState<ScrollVideoView>(INITIAL_VIEW);
  const [media] = useState(() => InitialMedia(options));

  useEffect(() => {
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;
    const controller = createScrollVideo({ container, stage }, optionsRef.current);
    controllerRef.current = controller;
    setView(controller.getView());
    const unsubscribe = controller.subscribe(setView);
    return () => {
      unsubscribe();
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.update(options);
  });

  const api = view.engine;
  const contextValue = useMemo(() => ({ api }), [api]);

  const loading = view.loader;
  const loaderContent = !loading
    ? null
    : typeof loader === "function"
      ? loader(loading, DefaultLoader(loading))
      : loader == null
        ? DefaultLoader(loading)
        : loading.background
          ? null
          : loader;

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <BaseStyles />
      <div ref={containerRef} data-vidscroll="" className={className} style={style}>
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
