export { ScrollVideo } from "./react/ScrollVideo";
export type { ScrollVideoProps, LoaderState } from "./react/ScrollVideo";
export { Section } from "./react/Section";
export type { SectionProps } from "./react/Section";
export { ScrollFrames } from "./react/ScrollFrames";
export { useScrollVideo } from "./react/context";

export * from "./core/types";
export { createEngine } from "./core/engine";
export { easing, type EasingName } from "./core/easing";
export {
  loadScrollVideo,
  type LoadVideoOptions,
  type LoadedVideo,
  type LoadPhase,
  type OptimizeOptions,
} from "./core/load";
export { probeMp4, type VideoProbe } from "./core/probe";
export { VidscrollError, type VidscrollErrorCode } from "./core/source";
export {
  createSmoothScroll,
  type SmoothScrollOptions,
  type SmoothScrollInstance,
} from "./core/smoothScroll";
export {
  createFrameScrubber,
  resolveFrameUrl,
  type FrameScrubber,
  type FrameScrubberOptions,
} from "./core/frameScrubber";
