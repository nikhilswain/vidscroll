import { describe, expect, it } from "vitest";
import { VidscrollError, checkSourceUrl } from "../../src/core/source";

const rejected = (src: string) => {
  try {
    checkSourceUrl(src);
  } catch (err) {
    return err instanceof VidscrollError ? err.code : "other";
  }
  return null;
};

describe("checkSourceUrl", () => {
  it.each([
    "https://www.youtube.com/watch?v=cwjMwmDSKV0",
    "https://youtu.be/cwjMwmDSKV0",
    "https://www.youtube.com/shorts/abc",
    "https://vimeo.com/76979871",
    "https://www.tiktok.com/@someone/video/123",
    "https://www.instagram.com/reel/abc/",
  ])("rejects the page link %s", (src) => {
    expect(rejected(src)).toBe("unsupported-url");
  });

  it.each(["https://cdn.example.com/live/master.m3u8?token=1", "https://cdn.example.com/stream.mpd"])(
    "rejects the stream %s",
    (src) => {
      expect(rejected(src)).toBe("unsupported-url");
    }
  );

  it.each([
    "/videos/hero.mp4",
    "hero.webm",
    "https://cdn.example.com/hero.mp4",
    "https://player.vimeo.com/progressive/file.mp4",
    "blob:http://localhost/abc",
  ])("accepts the video file %s", (src) => {
    expect(rejected(src)).toBeNull();
  });
});
