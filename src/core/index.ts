import { createScrollVideo as create } from "./controller";
import type { ScrollVideoController, ScrollVideoOptions } from "./controller";
import { injectStyles } from "./styles";

export function createScrollVideo(
  elements: { container: HTMLElement; stage: HTMLElement },
  options: ScrollVideoOptions
): ScrollVideoController {
  injectStyles();
  return create(elements, options);
}

export { styles } from "./styles";
export type {
  ScrollVideoController,
  ScrollVideoOptions,
  ScrollVideoEventMap,
  ScrollVideoEvent,
  LoaderState,
} from "./controller";
export { easing, type EasingName } from "./easing";
export { VidscrollError, type VidscrollErrorCode } from "./source";
export type {
  EngineStateSnapshot as ScrollVideoSnapshot,
  ScrollToOptionsLite as ScrollToOptions,
  SectionDescriptor as SectionRange,
} from "./types";
export type { OptimizeOptions, LoadedVideo } from "./load";
export type { VideoProbe } from "./probe";
export type { SmoothScrollOptions } from "./smoothScroll";
