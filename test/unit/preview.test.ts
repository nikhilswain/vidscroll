import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadScrollVideo } from "../../src/core/load";
import type { LoadedVideo } from "../../src/core/load";
import { transcodeForScrubbing, webCodecsAvailable } from "../../src/core/transcode";
import { FRAGMENTED_LONG_GOP, PREPARED, readBytes } from "./fixtures";

vi.mock("../../src/core/transcode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/transcode")>()),
  webCodecsAvailable: vi.fn(() => true),
  transcodeForScrubbing: vi.fn(),
}));

const transcode = vi.mocked(transcodeForScrubbing);

const serve = (path: string) => {
  const bytes = readBytes(path);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(bytes, {
          headers: { "content-type": "video/mp4", "content-length": String(bytes.byteLength) },
        })
    )
  );
};

let urls = 0;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(webCodecsAvailable).mockReturnValue(true);
  urls = 0;
  URL.createObjectURL = vi.fn(() => `blob:test-${++urls}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  transcode.mockReset();
});

describe("loadScrollVideo onPreview", () => {
  it("hands over the original before re-encoding, then resolves with the optimized copy", async () => {
    serve(FRAGMENTED_LONG_GOP);
    const events: string[] = [];
    let preview: LoadedVideo | null = null;
    transcode.mockImplementation(async () => {
      events.push("transcode");
      return new Blob(["optimized"], { type: "video/mp4" });
    });

    const result = await loadScrollVideo("/raw.mp4", {
      onPreview: (original) => {
        events.push("preview");
        preview = original;
      },
    });

    expect(events).toEqual(["preview", "transcode"]);
    expect(preview).toMatchObject({ source: "original", url: "blob:test-1" });
    expect(preview!.probe?.maxKeyframeGap).toBeCloseTo(8.3, 1);
    expect(result).toMatchObject({ source: "optimized", url: "blob:test-2" });
  });

  it("resolves with the same preview when re-encoding fails", async () => {
    serve(FRAGMENTED_LONG_GOP);
    transcode.mockRejectedValue(new Error("encoder unavailable"));
    let preview: LoadedVideo | null = null;

    const result = await loadScrollVideo("/raw.mp4", { onPreview: (original) => (preview = original) });

    expect(result).toBe(preview);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("doesn't create a preview without a listener", async () => {
    serve(FRAGMENTED_LONG_GOP);
    transcode.mockResolvedValue(new Blob(["optimized"], { type: "video/mp4" }));

    const result = await loadScrollVideo("/raw.mp4");

    expect(result.source).toBe("optimized");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("skips the preview when the video needs no re-encoding", async () => {
    serve(PREPARED);
    const onPreview = vi.fn();

    const result = await loadScrollVideo("/prepared.mp4", { onPreview });

    expect(result.source).toBe("original");
    expect(onPreview).not.toHaveBeenCalled();
    expect(transcode).not.toHaveBeenCalled();
  });

  it("leaves the preview to the caller when aborted mid re-encode", async () => {
    serve(FRAGMENTED_LONG_GOP);
    const controller = new AbortController();
    transcode.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const onPreview = vi.fn();

    const outcome = await loadScrollVideo("/raw.mp4", { onPreview, signal: controller.signal }).catch(
      (err: Error) => err.name
    );

    expect(outcome).toBe("AbortError");
    expect(onPreview).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
