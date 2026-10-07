export const GAP_LIMIT = 0.5;
export const LONG_VIDEO_S = 120;
export const LARGE_FILE_BYTES = 100 * 1024 * 1024;

export interface Analysis {
  name: string;
  size: number;
  container: string;
  codec: string | null;
  codecString: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  keyframes: number[];
  maxGap: number;
  hasAudio: boolean;
}

export interface SeekResult {
  playable: boolean;
  median: number;
  worst: number;
}

const CODEC_NAMES: Record<string, string> = {
  avc: "H.264",
  hevc: "H.265 (HEVC)",
  vp8: "VP8",
  vp9: "VP9",
  av1: "AV1",
};

export const codecName = (codec: string | null) => (codec ? (CODEC_NAMES[codec] ?? codec) : "Unknown");

export async function analyzeFile(file: File): Promise<Analysis> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This file has no video track.");
    const format = await input.getFormat();
    const duration = await track.computeDuration();
    const sink = new mb.EncodedPacketSink(track);
    const keyframes: number[] = [];
    const first = await sink.getFirstPacket({ metadataOnly: true });
    let key = first && first.type !== "key" ? await sink.getNextKeyPacket(first, { metadataOnly: true }) : first;
    while (key) {
      keyframes.push(key.timestamp);
      key = await sink.getNextKeyPacket(key, { metadataOnly: true });
    }
    let maxGap = keyframes.length ? duration - keyframes[keyframes.length - 1] : duration;
    for (let i = 1; i < keyframes.length; i++) maxGap = Math.max(maxGap, keyframes[i] - keyframes[i - 1]);
    const stats = await track.computePacketStats(100);
    return {
      name: file.name,
      size: file.size,
      container: format.name,
      codec: track.codec,
      codecString: await track.getCodecParameterString().catch(() => null),
      width: await track.getDisplayWidth(),
      height: await track.getDisplayHeight(),
      fps: stats.averagePacketRate,
      duration,
      keyframes,
      maxGap,
      hasAudio: (await input.getAudioTracks()).length > 0,
    };
  } finally {
    input.dispose();
  }
}

const once = (target: EventTarget, ok: string, fail: string) =>
  new Promise<boolean>((resolve) => {
    const done = (value: boolean) => () => {
      target.removeEventListener(ok, onOk);
      target.removeEventListener(fail, onFail);
      resolve(value);
    };
    const onOk = done(true);
    const onFail = done(false);
    target.addEventListener(ok, onOk);
    target.addEventListener(fail, onFail);
  });

export async function measureSeeks(file: File, duration: number, count = 20): Promise<SeekResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = once(video, "loadeddata", "error");
    video.src = url;
    if (!(await loaded)) return { playable: false, median: 0, worst: 0 };
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
      const target = ((i * 7919) % count) / count * duration * 0.98 + duration * 0.01;
      const seeked = once(video, "seeked", "error");
      const start = performance.now();
      video.currentTime = target;
      if (!(await seeked)) return { playable: false, median: 0, worst: 0 };
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return { playable: true, median: times[Math.floor(times.length / 2)], worst: times[times.length - 1] };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
