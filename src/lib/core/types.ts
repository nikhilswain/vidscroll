export interface EngineOptions {
  fps?: number; // assumed frames per second
  pixelsPerFrame?: number; // scroll granularity
  bufferFrames?: number; // extra frames at end to ensure last frame reachable
  easing?: (t: number) => number; // optional easing for display mapping
  video?: HTMLVideoElement; // externally provided video element (optional)
  scrollTarget?: Window | HTMLElement; // default window
  minScrollHeight?: number; // fallback minimum height
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
  linearProgress: number; // raw scroll mapped 0..1
  frameIndex: number; // current frame index
  totalFrames: number; // total frames
  duration: number; // video duration seconds
  activeSections: string[]; // ids
}

export interface EngineEventMap {
  ready: EngineStateSnapshot;
  update: EngineStateSnapshot;
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
  on<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>): void;
  off<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>): void;
  registerSection(desc: SectionDescriptor): void;
  unregisterSection(id: string): void;
}

// Internal extension (not part of public documented API yet)
export interface InternalEngineAPI extends EngineAPI {
  _attachSpacer?(el: HTMLDivElement): void;
}
