import type { EasingName } from "./easing";

export interface EngineOptions {
  container: HTMLElement;
  stage?: HTMLElement;
  length?: number | string;
  fps?: number;
  easing?: ((t: number) => number) | EasingName;
  video?: HTMLVideoElement;
  frames?: FrameRenderer;
  smoothingTauMs?: number;
  warmup?: boolean | number;
  preview?: boolean;
  debug?: boolean;
  onDebug?: (info: Record<string, unknown>) => void;
}

export interface ScrollToOptionsLite {
  behavior?: ScrollBehavior;
}

export interface FrameRenderer {
  count: number;
  draw(frameFloat: number): void;
}

export interface SectionDescriptor {
  id: string;
  start?: number;
  end?: number;
  fromTime?: number;
  toTime?: number;
  fromFrame?: number;
  toFrame?: number;
  data?: unknown;
}

export interface NormalizedSection {
  id: string;
  start: number;
  end: number;
  data?: unknown;
  pending?: boolean;
  _active?: boolean;
}

export interface EngineStateSnapshot {
  linearProgress: number;
  time: number;
  frameIndex: number;
  totalFrames: number;
  duration: number;
  activeSections: string[];
}

export interface EngineEventMap {
  ready: EngineStateSnapshot;
  update: EngineStateSnapshot;
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
  isReady(): boolean;
  notifyReady(): void;
  swapVideo(next: HTMLVideoElement): Promise<void>;
  on<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>): void;
  off<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>): void;
  addSection(desc: SectionDescriptor): void;
  removeSection(id: string): void;
  getSectionProgress(id: string): number;
  scrollToProgress(progress: number, opts?: ScrollToOptionsLite): void;
  scrollToTime(seconds: number, opts?: ScrollToOptionsLite): void;
}

export type ScrollVideoApi = Pick<
  EngineAPI,
  | "on"
  | "off"
  | "getState"
  | "isReady"
  | "scrollToTime"
  | "scrollToProgress"
  | "getSectionProgress"
  | "addSection"
  | "removeSection"
>;
