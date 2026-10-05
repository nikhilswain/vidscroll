import { act, createElement } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollVideo } from "../../src";
import type { LoaderState } from "../../src";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = (loader: (state: LoaderState, builtIn: ReactNode) => ReactNode) =>
  act(() => root.render(createElement(ScrollVideo, { src: "/video.mp4", loader })));

describe("ScrollVideo loader", () => {
  it("passes the built-in loader as the second argument", () => {
    const loader = vi.fn((_state: LoaderState, builtIn: ReactNode) =>
      createElement("section", { id: "custom" }, builtIn)
    );
    render(loader);
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "download", background: false }),
      expect.anything()
    );
    expect(container.querySelector("[data-vidscroll-loader] #custom")?.textContent).toContain("Loading video 0%");
  });

  it("renders no loader element when the function returns null", () => {
    render(() => null);
    expect(container.querySelector("[data-vidscroll-loader]")).toBeNull();
  });
});
