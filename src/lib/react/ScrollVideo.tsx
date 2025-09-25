import React, { useEffect, useRef, useState, useId } from "react";
import type { PropsWithChildren } from "react";
import { createEngine } from "../core/engine";
import type {
  EngineAPI,
  EngineStateSnapshot,
  EngineOptions,
  SectionDescriptor,
} from "../core/types";
import { ScrollVideoContext } from "./context";
import { useScrollVideo } from "./context";

interface ScrollVideoProps extends Omit<EngineOptions, "video"> {
  src: string;
  autoPlay?: boolean; // future use
  sectionDisplayMode?: "layered" | "exclusive" | "crossfade";
  crossfadeDurationMs?: number; // used in crossfade mode
}

export function ScrollVideo(props: PropsWithChildren<ScrollVideoProps>) {
  const {
    src,
    fps,
    pixelsPerFrame,
    bufferFrames,
    easing,
    children,
    sectionDisplayMode = "layered",
    crossfadeDurationMs = 500,
  } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const [api, setApi] = useState<EngineAPI | null>(null);
  const [state, setState] = useState<EngineStateSnapshot | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const spacer = spacerRef.current;
    if (!video || !spacer) return;

    const engine = createEngine({
      fps,
      pixelsPerFrame,
      bufferFrames,
      easing,
      video,
    });
    // internal private method for now
    // internal method (narrow cast to internal interface)
    (
      engine as { _attachSpacer?: (el: HTMLDivElement) => void }
    )._attachSpacer?.(spacer);

    const handleReady = (s: EngineStateSnapshot) => setState(s);
    const handleUpdate = (s: EngineStateSnapshot) => setState(s);

    engine.on("ready", handleReady);
    engine.on("update", handleUpdate);
    engine.on("resize", handleUpdate);
    setApi(engine);

    return () => {
      engine.off("ready", handleReady);
      engine.off("update", handleUpdate);
      engine.off("resize", handleUpdate);
      engine.destroy();
    };
  }, [src, fps, pixelsPerFrame, bufferFrames, easing]);

  return (
    <ScrollVideoContext.Provider
      value={{ api, state, sectionDisplayMode, crossfadeDurationMs }}
    >
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {children}
        </div>
      </div>
      <div ref={spacerRef} />
    </ScrollVideoContext.Provider>
  );
}

interface SectionProps extends Omit<SectionDescriptor, "id"> {
  id?: string; // allow auto id
  className?: string;
  as?: React.ElementType; // customization later
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
  const { api, state, sectionDisplayMode, crossfadeDurationMs } =
    useScrollVideo();
  const [leaving, setLeaving] = useState(false);
  const [active, setActive] = useState(false);

  // Register / unregister
  useEffect(() => {
    if (!api) return;
    const desc: SectionDescriptor = { id: sectionId, ...rest };
    api.registerSection(desc);
    return () => api.unregisterSection(sectionId);
    // Spread of rest stable enough for typical usage; if user passes new object each render it will re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, sectionId, JSON.stringify(rest)]);

  // Listen to section events to update active state
  useEffect(() => {
    if (!api) return;
    const handleEnter = (p: { id: string; state: EngineStateSnapshot }) => {
      if (p.id === sectionId) {
        setLeaving(false);
        setActive(true);
      }
    };
    const handleExit = (p: { id: string; state: EngineStateSnapshot }) => {
      if (p.id === sectionId) {
        if (sectionDisplayMode === "crossfade") {
          // enter leaving state
          setLeaving(true);
          setActive(false);
          const timeout = setTimeout(() => {
            setLeaving(false);
          }, crossfadeDurationMs);
          return () => clearTimeout(timeout);
        } else {
          setActive(false);
          setLeaving(false);
        }
      }
    };
    api.on("sectionEnter", handleEnter);
    api.on("sectionExit", handleExit);
    return () => {
      api.off("sectionEnter", handleEnter);
      api.off("sectionExit", handleExit);
    };
  }, [api, sectionId, sectionDisplayMode, crossfadeDurationMs]);

  // Also derive active from state.activeSections for immediate sync after resize
  useEffect(() => {
    if (!state) return;
    setActive(state.activeSections.includes(sectionId));
  }, [state, sectionId]);

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
