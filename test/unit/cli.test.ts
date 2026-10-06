import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { probeMp4 } from "../../src/core/probe";
import { FRAGMENTED_LONG_GOP, readBytes } from "./fixtures";

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["bin/vidscroll.mjs", ...args], { encoding: "utf8" });

const dir = mkdtempSync(join(tmpdir(), "vidscroll-cli-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("vidscroll CLI", () => {
  it("prints help", () => {
    const result = run("--help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: vidscroll encode");
  });

  it("fails clearly on a missing input", () => {
    const result = run("encode", "nope.mp4");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("input not found");
  });

  it("validates numeric options", () => {
    const result = run("encode", FRAGMENTED_LONG_GOP, "--gop", "abc");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--gop must be a positive number");
  });

  it("rejects unknown commands", () => {
    expect(run("frobnicate").status).toBe(1);
  });

  it("encodes a video with close keyframes", () => {
    const output = join(dir, "out.mp4");
    const result = run("encode", FRAGMENTED_LONG_GOP, output, "--resolution", "144", "--fps", "15");
    expect(result.status).toBe(0);
    const probe = probeMp4(readBytes(output).buffer);
    expect(probe?.height).toBe(144);
    expect(probe?.maxKeyframeGap).toBeLessThanOrEqual(10 / 15 + 0.01);
  });

  it("treats --fps as a cap and never adds frames", () => {
    const source = probeMp4(readBytes(FRAGMENTED_LONG_GOP).buffer)!;
    const output = join(dir, "capped.mp4");
    const result = run("encode", FRAGMENTED_LONG_GOP, output, "--resolution", "144", "--fps", "240");
    expect(result.status).toBe(0);
    const probe = probeMp4(readBytes(output).buffer)!;
    expect(probe.frameCount / probe.duration).toBeCloseTo(source.frameCount / source.duration, 0);
  });
});
