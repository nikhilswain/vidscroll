import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren } from "react";
import { createEngine } from "../core/engine";
import { createFrameScrubber, resolveFrameUrl } from "../core/frameScrubber";
import { acquireSmoothScroll } from "../core/smoothScroll";
import type { SmoothScrollOptions } from "../core/smoothScroll";
import type { EngineAPI, EngineOptions } from "../core/types";
import { ScrollVideoContext } from "./context";
import { BaseStyles } from "./styles";

export interface ScrollFramesProps
  extends Omit<EngineOptions, "video" | "frames" | "container" | "stage" | "warmup"> {
  urls: string | string[] | ((index: number) => string);
  count: number;
  fit?: "cover" | "contain";
  smoothScroll?: boolean | SmoothScrollOptions;
  className?: string;
  style?: CSSProperties;
}

export function ScrollFrames({
  urls,
  count,
  fit,
  smoothScroll,
  length,
  fps,
  easing,
  smoothingTauMs,
  debug,
  onDebug,
  className,
  style,
  children,
}: PropsWithChildren<ScrollFramesProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [api, setApi] = useState<EngineAPI | null>(null);

  const optionsRef = useRef({ urls, fit, smoothScroll, length, fps, easing, smoothingTauMs, debug, onDebug });
  optionsRef.current = { urls, fit, smoothScroll, length, fps, easing, smoothingTauMs, debug, onDebug };

  const smoothOn = !!smoothScroll;
  const lengthKey = String(length ?? "auto");

  useEffect(() => {
    if (!smoothOn) return;
    const o = optionsRef.current.smoothScroll;
    return acquireSmoothScroll(o && o !== true ? o : undefined);
  }, [smoothOn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!canvas || !container || !stage) return;
    const o = optionsRef.current;
    const scrubber = createFrameScrubber({
      canvas,
      urls: typeof o.urls === "string" ? resolveFrameUrl(o.urls) : o.urls,
      count,
      fit: o.fit,
    });
    const engine = createEngine({
      container,
      stage,
      length: o.length,
      fps: o.fps,
      easing: o.easing,
      smoothingTauMs: o.smoothingTauMs ?? (smoothOn ? 35 : undefined),
      debug: o.debug,
      onDebug: o.onDebug,
      frames: { count, draw: (f) => scrubber.draw(f) },
    });
    scrubber.onProgress(() => engine.notifyReady());
    if (scrubber.isReady()) engine.notifyReady();
    setApi(engine);
    return () => {
      setApi(null);
      engine.destroy();
      scrubber.destroy();
    };
  }, [count, smoothOn, lengthKey]);

  const contextValue = useMemo(() => ({ api }), [api]);

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <BaseStyles />
      <div ref={containerRef} data-vidscroll="" className={className} style={style}>
        <div ref={stageRef} data-vidscroll-stage="">
          <canvas ref={canvasRef} data-vidscroll-media="" />
          <div data-vidscroll-overlay="">{children}</div>
        </div>
      </div>
    </ScrollVideoContext.Provider>
  );
}
