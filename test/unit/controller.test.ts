import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScrollVideo } from "../../src/core/controller";
import type { ScrollVideoController } from "../../src/core/controller";
import { createEngine } from "../../src/core/engine";
import { loadScrollVideo } from "../../src/core/load";
import type { LoadVideoOptions, LoadedVideo } from "../../src/core/load";
import type { EngineAPI, EngineOptions, SectionDescriptor } from "../../src/core/types";

vi.mock("../../src/core/engine", () => ({ createEngine: vi.fn() }));
vi.mock("../../src/core/load", () => ({ loadScrollVideo: vi.fn() }));

interface FakeEngine extends EngineAPI {
  options: EngineOptions;
  destroyed: boolean;
  sections: Map<string, SectionDescriptor>;
  active: string[];
  emit(evt: string, payload: unknown): void;
  emitReady(): void;
  swap: { element: HTMLVideoElement; resolve: () => void; reject: (err: Error) => void } | null;
}

let engines: FakeEngine[];
let load: { opts: LoadVideoOptions; resolve: (v: LoadedVideo) => void; reject: (e: Error) => void };
let container: HTMLDivElement;
let stage: HTMLDivElement;
let controller: ScrollVideoController | null;

const video = (url: string, source: LoadedVideo["source"] = "optimized") => ({
  url,
  source,
  probe: null,
  release: vi.fn<() => void>(),
});

const media = () => [...stage.querySelectorAll<HTMLVideoElement>(":scope > video")];
const active = () => media()[0];
const lastEngine = () => engines[engines.length - 1];

beforeEach(() => {
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
      emit: (evt, payload) => handlers[evt]?.forEach((h) => h(payload)),
      emitReady() {
        ready = true;
        engine.emit("ready", {});
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
      swapVideo: (element) =>
        new Promise<void>((resolve, reject) => {
          engine.swap = { element, resolve, reject };
        }),
      on: (evt, h) => void (handlers[evt] ??= new Set()).add(h as (p: unknown) => void),
      off: (evt, h) => void handlers[evt]?.delete(h as (p: unknown) => void),
      addSection: (desc) => void engine.sections.set(desc.id, desc),
      removeSection: (id) => void engine.sections.delete(id),
      getSectionProgress: () => 0,
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
  container = document.createElement("div");
  stage = document.createElement("div");
  container.append(stage);
  document.body.append(container);
  controller = null;
});

afterEach(() => {
  controller?.destroy();
  container.remove();
  vi.restoreAllMocks();
});

const start = (options: Partial<Parameters<typeof createScrollVideo>[1]> = {}) =>
  (controller = createScrollVideo({ container, stage }, { src: "/raw.mp4", ...options }));

const flush = () => new Promise((r) => setTimeout(r));

describe("createScrollVideo", () => {
  it("adopts server-rendered media and shows the first-frame preview while downloading", () => {
    stage.innerHTML =
      '<video data-vidscroll-media="" data-fit="cover"></video>' +
      '<video data-vidscroll-media="" data-vidscroll-preview="" src="/raw.mp4#t=0.001"></video>' +
      "<div data-vidscroll-overlay></div>";
    const [placeholder, preview] = media();
    const c = start();

    expect(active()).toBe(placeholder);
    expect(media()[1]).toBe(preview);
    expect(c.getLoader()).toEqual({ phase: "download", progress: 0, background: false });
    expect(c.isReady()).toBe(false);
    expect(stage.lastElementChild?.hasAttribute("data-vidscroll-overlay")).toBe(true);
  });

  it("scrubs the original, keeps the badge through the swap, then hands over to the same element", async () => {
    const c = start();
    const original = video("blob:original", "original");
    const optimized = video("blob:optimized");

    load.opts.onPreview!(original);
    const first = active();
    expect(first.getAttribute("src")).toBe("blob:original");
    expect(lastEngine().options).toMatchObject({ video: first, preview: true });
    expect(c.getLoader()).toMatchObject({ phase: "preparing" });

    lastEngine().emitReady();
    load.opts.onProgress!("optimize", 0.5);
    expect(c.getLoader()).toEqual({ phase: "optimize", progress: 0.5, background: true });
    expect(stage.querySelector("[data-vidscroll-preview]")).toBeNull();

    load.resolve(optimized);
    await flush();
    const next = stage.querySelector<HTMLVideoElement>("[data-vidscroll-next]")!;
    expect(next.getAttribute("src")).toBe("blob:optimized");
    expect(lastEngine().swap?.element).toBe(next);
    expect(c.getLoader()).toEqual({ phase: "optimize", progress: 1, background: true });

    lastEngine().swap!.resolve();
    await flush();
    expect(media()).toEqual([next]);
    expect(next.hasAttribute("data-vidscroll-next")).toBe(false);
    expect(engines).toHaveLength(1);
    expect(original.release).toHaveBeenCalled();
    expect(optimized.release).not.toHaveBeenCalled();
    expect(c.getLoader()).toBeNull();
  });

  it("keeps the original when the swap fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = start({ src: "/swap-fails.mp4" });
    load.opts.onPreview!(video("blob:original", "original"));
    const first = active();
    lastEngine().emitReady();
    load.resolve(video("blob:optimized"));
    await flush();

    lastEngine().swap!.reject(new Error("decode error"));
    await flush();
    expect(media()).toEqual([first]);
    expect(c.getLoader()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("keeping the original"));
  });

  it("streams the source in a fresh element when the downloaded copy can't play", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = start({ src: "/cant-play.mp4" });
    load.resolve(video("blob:prepared", "original"));
    await flush();
    const first = active();
    lastEngine().emitReady();

    first.dispatchEvent(new Event("error"));
    expect(active()).not.toBe(first);
    expect(active().getAttribute("src")).toBe("/cant-play.mp4");
    expect(engines).toHaveLength(2);
    expect(engines[0].destroyed).toBe(true);
    expect(c.getLoader()).toMatchObject({ phase: "preparing" });
  });

  it("reports an error when even the stream can't play", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    const c = start({ src: "/broken.mp4", fullPreload: false, onError });

    active().dispatchEvent(new Event("error"));
    expect(c.getLoader()).toMatchObject({ phase: "error" });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "unplayable" }));
    expect(error).toHaveBeenCalled();
  });

  it("rebuilds the engine for a new length and reloads for a new source", () => {
    const c = start({ fullPreload: false });
    const first = active();
    c.update({ src: "/raw.mp4", fullPreload: false, length: "200vh" });
    expect(engines).toHaveLength(2);
    expect(lastEngine().options).toMatchObject({ video: first, length: "200vh" });

    c.update({ src: "/other.mp4", fullPreload: false, length: "200vh" });
    expect(active()).not.toBe(first);
    expect(active().getAttribute("src")).toBe("/other.mp4");
    expect(engines).toHaveLength(3);
  });

  it("updates fit and poster in place", () => {
    const c = start({ fullPreload: false });
    c.update({ src: "/raw.mp4", fullPreload: false, fit: "contain", poster: "/poster.jpg" });
    expect(active().getAttribute("data-fit")).toBe("contain");
    expect(active().getAttribute("poster")).toBe("/poster.jpg");
    expect(engines).toHaveLength(1);
  });

  it("keeps listeners and sections across engine rebuilds", () => {
    const c = start({ fullPreload: false });
    const updates = vi.fn();
    const exits = vi.fn();
    c.on("update", updates);
    c.on("sectionExit", exits);
    c.addSection({ id: "intro", fromTime: 0, toTime: 4 });
    expect(engines[0].sections.has("intro")).toBe(true);

    engines[0].active = ["intro"];
    engines[0].emit("update", { ...engines[0].getState(), time: 1 });
    expect(updates).toHaveBeenLastCalledWith(expect.objectContaining({ time: 1 }));

    c.update({ src: "/raw.mp4", fullPreload: false, length: "300vh" });
    expect(exits).toHaveBeenCalledWith(expect.objectContaining({ id: "intro" }));
    expect(engines[1].sections.has("intro")).toBe(true);
    engines[1].emit("update", { ...engines[0].getState(), time: 2 });
    expect(updates).toHaveBeenLastCalledWith(expect.objectContaining({ time: 2 }));

    engines[0].emit("update", { ...engines[0].getState(), time: 9 });
    expect(updates).not.toHaveBeenCalledWith(expect.objectContaining({ time: 9 }));

    c.removeSection("intro");
    expect(engines[1].sections.has("intro")).toBe(false);
    expect(() => c.addSection({ id: "a" })).not.toThrow();
    expect(() => c.addSection({ id: "a" })).toThrow(/already exists/);
  });

  it("emits loader changes", async () => {
    const c = start();
    const loaders = vi.fn();
    c.on("loader", loaders);
    load.opts.onProgress!("download", 0.42);
    expect(loaders).toHaveBeenLastCalledWith({ phase: "download", progress: 0.42, background: false });
    load.opts.onProgress!("download", 0.421);
    expect(loaders).toHaveBeenCalledTimes(1);
  });

  it("aborts loading, releases downloads and removes its media on destroy", () => {
    const c = start();
    const original = video("blob:original", "original");
    load.opts.onPreview!(original);
    c.destroy();
    controller = null;
    expect(load.opts.signal?.aborted).toBe(true);
    expect(original.release).toHaveBeenCalled();
    expect(lastEngine().destroyed).toBe(true);
    expect(media()).toEqual([]);
  });
});
