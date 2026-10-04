import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { loadScrollVideo } from "../../src/core/load";
import { FRAGMENTED_LONG_GOP, PREPARED, readBytes } from "./fixtures";

const videoResponse = (bytes: Uint8Array<ArrayBuffer>) =>
  new Response(bytes, {
    headers: { "content-type": "video/mp4", "content-length": String(bytes.byteLength) },
  });

const errorCode = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (err: { code?: string }) => err.code
  );

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadScrollVideo", () => {
  it("rejects page links before fetching anything", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await errorCode(loadScrollVideo("https://youtu.be/abc"))).toBe("unsupported-url");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    expect(await errorCode(loadScrollVideo("/missing.mp4"))).toBe("http-error");
  });

  it("reports an HTML page served in place of a video", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }))
    );
    expect(await errorCode(loadScrollVideo("/typo.mp4"))).toBe("not-a-video");
  });

  it("falls back to streaming when the bytes can't be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const result = await loadScrollVideo("https://other.example/video.mp4");
    expect(result.source).toBe("stream");
    expect(result.url).toBe("https://other.example/video.mp4");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("CORS"));
  });

  it("uses a video with close keyframes as-is", async () => {
    const bytes = readBytes(PREPARED);
    vi.stubGlobal("fetch", vi.fn(async () => videoResponse(bytes)));
    const progress: number[] = [];
    const result = await loadScrollVideo("/prepared.mp4", { onProgress: (_, v) => progress.push(v) });
    expect(result.source).toBe("original");
    expect(result.probe?.maxKeyframeGap).toBeCloseTo(0.33, 1);
    expect(progress.at(-1)).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns about sparse keyframes when optimizing is off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => videoResponse(readBytes(FRAGMENTED_LONG_GOP))));
    const result = await loadScrollVideo("/raw.mp4", { optimize: false });
    expect(result.source).toBe("original");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("8.3s apart"));
  });

  it("warns when the browser can't re-encode", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => videoResponse(readBytes(FRAGMENTED_LONG_GOP))));
    const result = await loadScrollVideo("/raw-no-webcodecs.mp4");
    expect(result.source).toBe("original");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no WebCodecs"));
  });
});
