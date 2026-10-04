import { describe, expect, it } from "vitest";
import { probeMp4 } from "../../src/core/probe";
import { FRAGMENTED_LONG_GOP, PREPARED, readBytes } from "./fixtures";

describe("probeMp4", () => {
  it("reads keyframe spacing from a fragmented MP4", () => {
    const probe = probeMp4(readBytes(FRAGMENTED_LONG_GOP).buffer);
    expect(probe).toMatchObject({ width: 1920, height: 1080, frameCount: 1799 });
    expect(probe!.duration).toBeCloseTo(59.97, 1);
    expect(probe!.maxKeyframeGap).toBeCloseTo(8.33, 1);
  });

  it("reads keyframe spacing from a regular MP4", () => {
    const probe = probeMp4(readBytes(PREPARED).buffer);
    expect(probe).toMatchObject({ width: 1280, height: 720, frameCount: 895 });
    expect(probe!.maxKeyframeGap).toBeCloseTo(10 / 29.97, 2);
  });

  it("returns null for data that isn't an MP4", () => {
    expect(probeMp4(new TextEncoder().encode("<!doctype html><p>not a video</p>").buffer)).toBeNull();
  });

  it("returns null for a truncated file", () => {
    expect(probeMp4(readBytes(PREPARED).slice(0, 1000).buffer)).toBeNull();
  });
});
