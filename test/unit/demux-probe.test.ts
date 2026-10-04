import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { afterAll, describe, expect, it } from "vitest";
import { probeWithDemuxer } from "../../src/core/transcode";

const dir = mkdtempSync(join(tmpdir(), "vidscroll-webm-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function makeWebm(name: string, extraArgs: string[]) {
  const output = join(dir, name);
  const result = spawnSync(ffmpeg as unknown as string, [
    "-y",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", "testsrc=size=160x90:rate=24:duration=6",
    "-c:v", "libvpx-vp9",
    "-deadline", "realtime",
    "-g", "48",
    "-keyint_min", "48",
    ...extraArgs,
    output,
  ]);
  expect(result.status).toBe(0);
  return new Blob([readFileSync(output)], { type: "video/webm" });
}

describe("probeWithDemuxer", () => {
  it("reads keyframe spacing from a WebM", async () => {
    const probe = await probeWithDemuxer(makeWebm("plain.webm", []));
    expect(probe?.duration).toBeCloseTo(6, 0);
    expect(probe?.maxKeyframeGap).toBeCloseTo(2, 1);
  });

  it("finds keyframes when the first packet starts after zero", async () => {
    const probe = await probeWithDemuxer(makeWebm("offset.webm", ["-output_ts_offset", "0.007"]));
    expect(probe).not.toBeNull();
    expect(probe?.maxKeyframeGap).toBeCloseTo(2, 1);
  });
});
