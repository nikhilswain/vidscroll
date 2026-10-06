import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScrollVideo } from "../../src/core/controller";
import type { ScrollVideoController } from "../../src/core/controller";
import { engines, flush, installFakes, lastEngine, load, video } from "./fakes";

vi.mock("../../src/core/engine", () => ({ createEngine: vi.fn() }));
vi.mock("../../src/core/load", () => ({ loadScrollVideo: vi.fn() }));

let container: HTMLDivElement;
let stage: HTMLDivElement;
let controller: ScrollVideoController | null;

const media = () => [...stage.querySelectorAll<HTMLVideoElement>(":scope > video")];
const active = () => media()[0];

beforeEach(() => {
  installFakes();
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
