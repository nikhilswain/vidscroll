#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const HELP = `Usage: vidscroll encode <input> [output] [options]

Re-encode a video for smooth scroll scrubbing (short keyframe interval,
capped resolution, no audio). Output defaults to the input name with
the extension replaced by .scroll.mp4 (hero.mov -> hero.scroll.mp4).

Options:
  --resolution <px>  Short-side resolution cap, e.g. 720 or 1080 (default 720)
  --gop <frames>     Frames between keyframes (default 10)
  --crf <n>          Quality, lower is better and bigger; 18-28 (default 22)
  --fps <n>          Frame-rate cap (default: keep source rate)
  -h, --help         Show this help

Requires ffmpeg: set FFMPEG_PATH, install it on your PATH, or
\`npm i -D ffmpeg-static\`.`;

function fail(message) {
  console.error(`vidscroll: ${message}`);
  process.exit(1);
}

async function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const bundled = await import("ffmpeg-static").then((m) => m.default, () => null);
  if (bundled && existsSync(bundled)) return bundled;
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.status === 0) return "ffmpeg";
  return null;
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") flags.help = true;
    else if (arg.startsWith("--")) {
      const value = argv[++i];
      if (value == null) fail(`${arg} needs a value`);
      flags[arg.slice(2)] = value;
    } else positional.push(arg);
  }
  return { flags, positional };
}

function numberFlag(flags, name, fallback) {
  if (flags[name] == null) return fallback;
  const n = Number(flags[name]);
  if (!Number.isFinite(n) || n <= 0) fail(`--${name} must be a positive number`);
  return n;
}

async function encode(argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help) return console.log(HELP);
  const [input, output = input?.replace(/(\.\w+)?$/, ".scroll.mp4")] = positional;
  if (!input) fail(`missing <input>\n\n${HELP}`);
  if (!existsSync(input)) fail(`input not found: ${input}`);
  if (output === input) fail("output must differ from input");

  const resolution = numberFlag(flags, "resolution", 720);
  const gop = Math.round(numberFlag(flags, "gop", 10));
  const crf = numberFlag(flags, "crf", 22);
  const fps = numberFlag(flags, "fps", null);

  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) {
    fail(
      "ffmpeg not found. Install it (https://ffmpeg.org/download.html), set " +
        "FFMPEG_PATH, or run `npm i -D ffmpeg-static`."
    );
  }

  const scale =
    `scale='if(gt(iw,ih),-2,min(${resolution},iw))':` +
    `'if(gt(iw,ih),min(${resolution},ih),-2)'`;
  const filters = [scale, ...(fps ? [`fps=fps='min(source_fps,${fps})'`] : [])].join(",");

  const result = spawnSync(
    ffmpeg,
    [
      "-y",
      "-loglevel", "error",
      "-stats",
      "-i", input,
      "-an",
      "-vf", filters,
      "-c:v", "libx264",
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      "-g", String(gop),
      "-keyint_min", String(gop),
      "-sc_threshold", "0",
      "-crf", String(crf),
      "-movflags", "+faststart",
      output,
    ],
    { stdio: "inherit" }
  );
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);

  const inMb = statSync(input).size / 1048576;
  const outMb = statSync(output).size / 1048576;
  console.log(
    `\n${output}  ${outMb.toFixed(1)}MB (input ${inMb.toFixed(1)}MB), ` +
      `keyframe every ${gop} frames`
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === "encode") {
  await encode(rest);
} else if (!command || command === "-h" || command === "--help" || command === "help") {
  console.log(HELP);
} else {
  fail(`unknown command "${command}"\n\n${HELP}`);
}
