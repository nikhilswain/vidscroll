import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollVideo } from "../../src";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScrollVideo server rendering", () => {
  it("renders the first-frame preview on the server and keeps those elements after hydration", () => {
    const element = createElement(ScrollVideo, { src: "/video.mp4" });
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);
    const served = [...container.querySelectorAll("video")];
    expect(served.map((v) => v.getAttribute("src"))).toEqual([null, "/video.mp4#t=0.001"]);
    served.forEach((v) => (v.muted = v.hasAttribute("muted")));

    const error = vi.spyOn(console, "error");
    let root!: ReturnType<typeof hydrateRoot>;
    act(() => {
      root = hydrateRoot(container, element);
    });
    expect(container.querySelector("[data-vidscroll-loader]")?.textContent).toContain("Loading video 0%");
    expect(error).not.toHaveBeenCalled();
    expect([...container.querySelectorAll("video")]).toEqual(served);

    act(() => root.unmount());
    container.remove();
  });
});
