import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../src/element";
import type { VidScrollElement } from "../../src/element";
import { engines, flush, installFakes, lastEngine, load, video } from "./fakes";

vi.mock("../../src/core/engine", () => ({ createEngine: vi.fn() }));
vi.mock("../../src/core/load", () => ({ loadScrollVideo: vi.fn() }));

let host: HTMLDivElement;

beforeEach(() => {
  installFakes();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
});

const mount = async (html: string) => {
  host.innerHTML = html;
  await flush();
  return host.querySelector("vid-scroll") as VidScrollElement;
};

const shadow = (el: VidScrollElement) => el.shadowRoot!;
const loaderBox = (el: VidScrollElement) => shadow(el).querySelector<HTMLElement>("[data-vidscroll-loader]")!;

describe("<vid-scroll>", () => {
  it("renders a pinned stage with the video and slots its children", async () => {
    const el = await mount('<vid-scroll src="/raw.mp4" full-preload="false"><h1>Title</h1></vid-scroll>');
    const stage = shadow(el).querySelector("[data-vidscroll-stage]")!;
    const videoEl = stage.querySelector("video")!;
    expect(videoEl.getAttribute("part")).toBe("video");
    expect(videoEl.getAttribute("src")).toBe("/raw.mp4");
    expect(stage.querySelector("[data-vidscroll-overlay] slot:not([name])")).not.toBeNull();
    expect(el.querySelector("h1")!.parentElement).toBe(el);
    expect(lastEngine().options).toMatchObject({ container: el, stage, video: videoEl });
  });

  it("maps attributes to options", async () => {
    await mount(
      '<vid-scroll src="/raw.mp4" length="300vh" easing="inOutSine" fps="24" fit="contain" optimize="wait" warmup="false"></vid-scroll>'
    );
    expect(load.opts.optimize).toEqual({ wait: true });
    load.resolve(video("blob:prepared", "original"));
    await flush();
    expect(lastEngine().options).toMatchObject({ length: "300vh", easing: "inOutSine", fps: 24, warmup: false });
    expect(lastEngine().options.video!.getAttribute("data-fit")).toBe("contain");
  });

  it("shows the built-in loader and mirrors its state on the element", async () => {
    const el = await mount('<vid-scroll src="/raw.mp4"></vid-scroll>');
    const loaders: unknown[] = [];
    el.addEventListener("vidscroll-loader", (e) => loaders.push((e as CustomEvent).detail));
    expect(el.dataset.phase).toBe("download");
    expect(loaderBox(el).hidden).toBe(false);
    expect(loaderBox(el).textContent).toContain("Loading video 0%");

    load.opts.onProgress!("download", 0.5);
    expect(loaderBox(el).textContent).toContain("Loading video 50%");
    expect(el.style.getPropertyValue("--loader-progress")).toBe("0.50");
    expect(loaders).toEqual([{ phase: "download", progress: 0.5, background: false }]);

    load.resolve(video("blob:prepared", "original"));
    await flush();
    lastEngine().emitReady();
    expect(loaderBox(el).hidden).toBe(true);
    expect(el.hasAttribute("data-phase")).toBe(false);
  });

  it("hides the loader with loader=none and uses a slotted loader for blocking phases only", async () => {
    let el = await mount('<vid-scroll src="/raw.mp4" loader="none"></vid-scroll>');
    expect(loaderBox(el).hidden).toBe(true);

    el = await mount('<vid-scroll src="/raw.mp4"><div slot="loader">Wait</div></vid-scroll>');
    expect(loaderBox(el).hidden).toBe(false);
    load.opts.onPreview!(video("blob:original", "original"));
    lastEngine().emitReady();
    load.opts.onProgress!("optimize", 0.3);
    expect(el.dataset.phase).toBe("optimize");
    expect(el.hasAttribute("data-background")).toBe(true);
    expect(loaderBox(el).hidden).toBe(true);
  });

  it("registers sections and reflects their state", async () => {
    const el = await mount(
      '<vid-scroll src="/raw.mp4" full-preload="false">' +
        '<vid-scroll-section id="intro" from-time="0" to-time="4"><p>Hi</p></vid-scroll-section>' +
        "</vid-scroll>"
    );
    const section = el.querySelector<HTMLElement>("vid-scroll-section")!;
    expect(lastEngine().sections.get("intro")).toMatchObject({ id: "intro", fromTime: 0, toTime: 4 });
    expect(section.getAttribute("data-vidscroll-section")).toBe("intro");

    const entered = vi.fn();
    el.addEventListener("vidscroll-enter", entered);
    lastEngine().emit("sectionEnter", { id: "intro", state: lastEngine().getState() });
    expect(section.hasAttribute("data-active")).toBe(true);
    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ detail: { id: "intro" } }));

    lastEngine().progress.set("intro", 0.25);
    lastEngine().emit("update", lastEngine().getState());
    expect(section.style.getPropertyValue("--progress")).toBe("0.2500");

    section.setAttribute("to-time", "6");
    expect(lastEngine().sections.get("intro")).toMatchObject({ toTime: 6 });

    section.remove();
    expect(lastEngine().sections.has("intro")).toBe(false);
  });

  it("rebuilds on attribute changes, stops without a source, and cleans up when removed", async () => {
    const el = await mount('<vid-scroll src="/raw.mp4" full-preload="false"></vid-scroll>');
    el.setAttribute("length", "200vh");
    await flush();
    expect(engines).toHaveLength(2);
    expect(lastEngine().options.length).toBe("200vh");

    el.removeAttribute("src");
    await flush();
    expect(lastEngine().destroyed).toBe(true);
    expect(el.api).toBeNull();

    el.setAttribute("src", "/other.mp4");
    await flush();
    expect(lastEngine().options.video!.getAttribute("src")).toBe("/other.mp4");

    el.remove();
    expect(lastEngine().destroyed).toBe(true);
    expect(shadow(el).querySelectorAll("video")).toHaveLength(0);
  });

  it("dispatches load and ready events and passes object options through the options property", async () => {
    const el = document.createElement("vid-scroll");
    const onLoad = vi.fn();
    el.options = { onLoad, optimize: { maxResolution: 720 } };
    el.setAttribute("src", "/raw.mp4");
    const events: string[] = [];
    el.addEventListener("vidscroll-load", () => events.push("load"));
    el.addEventListener("vidscroll-ready", () => events.push("ready"));
    host.append(el);
    expect(load.opts.optimize).toEqual({ maxResolution: 720 });

    load.resolve(video("blob:prepared", "original"));
    await flush();
    lastEngine().emitReady();
    expect(onLoad).toHaveBeenCalledWith({ source: "original", probe: null });
    expect(events).toEqual(["load", "ready"]);
  });
});
