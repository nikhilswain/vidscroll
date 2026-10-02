export interface EngineOptions {
  /** Assumed frames per second; auto-refined where measurable (prime window). */
  fps?: number;
  /** Scroll granularity: pixels of scroll per video frame. */
  pixelsPerFrame?: number;
  /** Extra frames worth of scroll so the last frame is comfortably reachable. */
  bufferFrames?: number;
  /** Optional easing applied when mapping progress to video time. */
  easing?: (t: number) => number;
  /** The video element to scrub. Required unless `frames` is provided. */
  video?: HTMLVideoElement;
  /** Canvas image-sequence renderer; replaces the video element when set. */
  frames?: FrameRenderer;
  /** Scroll container; defaults to the window. */
  scrollTarget?: Window | HTMLElement;
  /** Fallback minimum spacer height (px). */
  minScrollHeight?: number;
  /** Tall element providing the scrollable length (managed by the React layer). */
  spacer?: HTMLDivElement | null;
  /** Smoothing time constant in ms; lower = tighter scroll tracking (default 100). */
  smoothingTauMs?: number;
  /**
   * Video mode: seek through the whole timeline once after load so the first
   * user scroll isn't cold. `false` disables; a number sets the step count.
   * Default: enabled with automatic step count.
   */
  warmup?: boolean | number;
  /** Log internal state changes to the console. */
  debug?: boolean;
  /** Structured debug callback. */
  onDebug?: (info: Record<string, unknown>) => void;
}

export interface FrameRenderer {
  /** Number of frames in the sequence. */
  count: number;
  /** Draw the sequence position; the fractional part is between frames. */
  draw(frameFloat: number): void;
}

export interface SectionDescriptor {
  id: string;
  start?: number; // normalized 0..1
  end?: number; // normalized 0..1 (exclusive of end for activation)
  fromTime?: number; // in seconds
  toTime?: number; // in seconds
  fromFrame?: number;
  toFrame?: number;
  mode?: string; // will be used later for pin/overlay/etc
  data?: unknown; // user supplied arbitrary metadata
}

export interface NormalizedSection {
  id: string;
  start: number; // 0..1
  end: number; // 0..1
  mode: string;
  data?: unknown;
  _active?: boolean;
}

export interface EngineStateSnapshot {
  linearProgress: number; // smoothed scroll progress 0..1
  frameIndex: number; // current frame index
  totalFrames: number; // total frames
  duration: number; // video duration seconds (0 in frames mode)
  activeSections: string[]; // ids
}

export interface EngineEventMap {
  ready: EngineStateSnapshot;
  update: EngineStateSnapshot;
  /** Video warm-up sweep progress, 0..1 (fires before "ready"). */
  warmup: { value: number };
  sectionEnter: { id: string; state: EngineStateSnapshot };
  sectionExit: { id: string; state: EngineStateSnapshot };
  resize: EngineStateSnapshot;
}

export type EngineEvent = keyof EngineEventMap;
export type EngineEventHandler<K extends EngineEvent> = (
  payload: EngineEventMap[K]
) => void;

export interface EngineAPI {
  destroy(): void;
  getState(): EngineStateSnapshot;
  /** True once "ready" has fired (after warm-up in video mode). */
  isReady(): boolean;
  /** Frames mode only: call once the renderer can draw; the engine emits "ready". */
  notifyReady(): void;
  on<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>): void;
  off<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>): void;
  registerSection(desc: SectionDescriptor): void;
  unregisterSection(id: string): void;
}
