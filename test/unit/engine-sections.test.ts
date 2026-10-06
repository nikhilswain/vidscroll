import { afterEach, describe, expect, it, vi } from "vitest";
import { createEngine } from "../../src/core/engine";
import type { EngineAPI } from "../../src/core/types";

let engine: EngineAPI | null = null;

afterEach(() => {
  engine?.destroy();
  engine = null;
  document.body.replaceChildren();
});

function setup() {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  const container = document.createElement("div");
  const video = document.createElement("video");
  container.append(video);
  document.body.append(container);
  engine = createEngine({ container, video, warmup: false });
  return { video, engine };
}

describe("engine ticks", () => {
  it("stays finite when two ticks share a timestamp", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const runFrame = (now: number) => frames.splice(0).forEach((cb) => cb(now));
    const { video, engine } = setup();
    Object.defineProperty(video, "duration", { configurable: true, value: 30 });
    video.dispatchEvent(new Event("loadedmetadata"));

    runFrame(100);
    document.dispatchEvent(new Event("scroll"));
    runFrame(200);
    document.dispatchEvent(new Event("scroll"));
    runFrame(200);
    runFrame(200);
    runFrame(216);

    expect(Number.isFinite(engine.getState().linearProgress)).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("engine sections", () => {
  it("keeps time-based sections inactive until the duration is known", () => {
    const { video, engine } = setup();
    const entered = vi.fn();
    engine.on("sectionEnter", entered);

    engine.addSection({ id: "later", fromTime: 10, toTime: 20 });
    engine.addSection({ id: "frames", fromFrame: 100, toFrame: 200 });
    engine.addSection({ id: "progress", start: 0, end: 0.5 });

    expect(entered.mock.calls.map(([e]) => e.id)).toEqual(["progress"]);
    expect(engine.getSectionProgress("later")).toBe(0);

    Object.defineProperty(video, "duration", { configurable: true, value: 30 });
    video.dispatchEvent(new Event("loadedmetadata"));

    expect(entered.mock.calls.map(([e]) => e.id)).toEqual(["progress"]);
    expect(engine.getState().activeSections).toEqual(["progress"]);
  });
});
