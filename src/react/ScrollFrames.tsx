import { useEffect, useRef, useState, useMemo } from "react";
import type { PropsWithChildren } from "react";
import { createEngine } from "../core/engine";
import { createFrameScrubber, resolveFrameUrl } from "../core/frameScrubber";
import { createSmoothScroll } from "../core/smoothScroll";
import type { SmoothScrollOptions } from "../core/smoothScroll";
import type { EngineAPI, EngineOptions } from "../core/types";
import { ScrollVideoContext } from "./context";

interface ScrollFramesProps
  extends Omit<EngineOptions, "video" | "spacer" | "frames"> {
  urls: string | string[] | ((index: number) => string);
  count: number;
  fit?: "cover" | "contain";
  smoothScroll?: boolean | SmoothScrollOptions;
  sectionDisplayMode?: "layered" | "exclusive" | "crossfade";
  crossfadeDurationMs?: number;
}

export function ScrollFrames({
  urls,
  count,
  fit,
  smoothScroll,
  fps,
  pixelsPerFrame,
  bufferFrames,
  easing,
  scrollTarget,
  minScrollHeight,
  smoothingTauMs,
  debug,
  onDebug,
  children,
  sectionDisplayMode = "layered",
  crossfadeDurationMs = 500,
}: PropsWithChildren<ScrollFramesProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const [api, setApi] = useState<EngineAPI | null>(null);

  const optionsRef = useRef({
    urls,
    count,
    fit,
    smoothScroll,
    fps,
    pixelsPerFrame,
    bufferFrames,
    easing,
    scrollTarget,
    minScrollHeight,
    smoothingTauMs,
    debug,
    onDebug,
  });
  optionsRef.current = {
    urls,
    count,
    fit,
    smoothScroll,
    fps,
    pixelsPerFrame,
    bufferFrames,
    easing,
    scrollTarget,
    minScrollHeight,
    smoothingTauMs,
    debug,
    onDebug,
  };

  const smoothOn = !!smoothScroll;

  useEffect(() => {
    if (!smoothOn) return;
    const o = optionsRef.current.smoothScroll;
    const instance = createSmoothScroll(
      o && o !== true ? o : undefined
    );
    return () => instance.destroy();
  }, [smoothOn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const spacer = spacerRef.current;
    if (!canvas || !spacer) return;
    const o = optionsRef.current;
    const urlOf =
      typeof o.urls === "string" ? resolveFrameUrl(o.urls) : o.urls;
    const scrubber = createFrameScrubber({
      canvas,
      urls: urlOf,
      count: o.count,
      fit: o.fit,
    });
    const engine = createEngine({
      spacer,
      fps: o.fps,
      pixelsPerFrame: o.pixelsPerFrame,
      bufferFrames: o.bufferFrames,
      easing: o.easing,
      scrollTarget: o.scrollTarget,
      minScrollHeight: o.minScrollHeight,
      smoothingTauMs: o.smoothingTauMs ?? (smoothOn ? 35 : undefined),
      debug: o.debug,
      onDebug: o.onDebug,
      frames: { count: o.count, draw: (f) => scrubber.draw(f) },
    });
    scrubber.onProgress(() => engine.notifyReady());
    if (scrubber.isReady()) engine.notifyReady();
    setApi(engine);
    return () => {
      setApi(null);
      engine.destroy();
      scrubber.destroy();
    };
  }, [count, smoothOn]);

  const contextValue = useMemo(
    () => ({ api, sectionDisplayMode, crossfadeDurationMs }),
    [api, sectionDisplayMode, crossfadeDurationMs]
  );

  return (
    <ScrollVideoContext.Provider value={contextValue}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {children}
        </div>
      </div>
      <div ref={spacerRef} />
    </ScrollVideoContext.Provider>
  );
}
