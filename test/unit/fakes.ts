import { vi } from "vitest";
import { createEngine } from "../../src/core/engine";
import { loadScrollVideo } from "../../src/core/load";
import type { LoadVideoOptions, LoadedVideo } from "../../src/core/load";
import type { EngineAPI, EngineOptions, SectionDescriptor } from "../../src/core/types";

export interface FakeEngine extends EngineAPI {
  options: EngineOptions;
  destroyed: boolean;
  sections: Map<string, SectionDescriptor>;
  active: string[];
  progress: Map<string, number>;
  easing?: EngineOptions["easing"];
  smoothing?: number;
  emit(evt: string, payload: unknown): void;
  emitReady(): void;
  swap: { element: HTMLVideoElement; resolve: () => void; reject: (err: Error) => void } | null;
}

export let engines: FakeEngine[] = [];
export let load: { opts: LoadVideoOptions; resolve: (v: LoadedVideo) => void; reject: (e: Error) => void };

export const lastEngine = () => engines[engines.length - 1];

export const video = (url: string, source: LoadedVideo["source"] = "optimized") => ({
  url,
  source,
  probe: null,
  release: vi.fn<() => void>(),
});

export const flush = () => new Promise((r) => setTimeout(r));

export function installFakes() {
  engines = [];
  vi.mocked(createEngine).mockImplementation((options) => {
    const handlers: Record<string, Set<(p: unknown) => void>> = {};
    let ready = false;
    const engine: FakeEngine = {
      options,
      destroyed: false,
      swap: null,
      sections: new Map(),
      active: [],
      progress: new Map(),
      emit: (evt, payload) => handlers[evt]?.forEach((h) => h(payload)),
      emitReady() {
        ready = true;
        engine.emit("ready", engine.getState());
      },
      destroy() {
        engine.destroyed = true;
      },
      getState: () => ({
        linearProgress: 0,
        time: 0,
        frameIndex: 0,
        totalFrames: 0,
        duration: 0,
        activeSections: engine.active,
      }),
      isReady: () => ready,
      notifyReady() {},
      setEasing: (option) => void (engine.easing = option),
      setSmoothing: (ms) => void (engine.smoothing = ms),
      swapVideo: (element) =>
        new Promise<void>((resolve, reject) => {
          engine.swap = { element, resolve, reject };
        }),
      on: (evt, h) => void (handlers[evt] ??= new Set()).add(h as (p: unknown) => void),
      off: (evt, h) => void handlers[evt]?.delete(h as (p: unknown) => void),
      addSection: (desc) => void engine.sections.set(desc.id, desc),
      removeSection: (id) => void engine.sections.delete(id),
      getSectionProgress: (id) => engine.progress.get(id) ?? 0,
      scrollToProgress() {},
      scrollToTime() {},
    };
    engines.push(engine);
    return engine;
  });
  vi.mocked(loadScrollVideo).mockImplementation(
    (_src, opts = {}) =>
      new Promise((resolve, reject) => {
        load = { opts, resolve, reject };
      })
  );
}
