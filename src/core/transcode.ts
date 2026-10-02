import type { VideoProbe } from "./probe";

export interface TranscodeOptions {
  /** Short-side resolution cap in px (720 = 720p for landscape and portrait). */
  maxResolution: number;
  /** Frame rate cap. */
  maxFps: number;
  /** Seconds between keyframes in the output. */
  keyframeInterval: number;
  onProgress?: (value: number) => void;
  signal?: AbortSignal;
}

export function webCodecsAvailable() {
  return (
    typeof VideoDecoder !== "undefined" && typeof VideoEncoder !== "undefined"
  );
}

// mediabunny is large; it's only fetched when a video actually needs work.
const loadMediabunny = () => import("mediabunny");

/** Keyframe layout via a full demuxer (for containers probeMp4 can't read). */
export async function probeWithDemuxer(blob: Blob): Promise<VideoProbe | null> {
  const mb = await loadMediabunny();
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const sink = new mb.EncodedPacketSink(track);
    const duration = await track.computeDuration();
    let maxGap = 0;
    let prev: number | null = null;
    let key = await sink.getKeyPacket(0, { metadataOnly: true });
    while (key) {
      if (prev != null) maxGap = Math.max(maxGap, key.timestamp - prev);
      prev = key.timestamp;
      key = await sink.getNextKeyPacket(key, { metadataOnly: true });
    }
    if (prev == null) return null;
    maxGap = Math.max(maxGap, duration - prev);
    const stats = await track.computePacketStats(100);
    return {
      duration,
      width: await track.getDisplayWidth(),
      height: await track.getDisplayHeight(),
      frameCount: Math.round(duration * stats.averagePacketRate),
      maxKeyframeGap: maxGap,
    };
  } finally {
    input.dispose();
  }
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Re-encode a video so every seek is cheap: keyframes every
 * `keyframeInterval` seconds, capped resolution/fps, no audio. Uses WebCodecs
 * through mediabunny.
 */
export async function transcodeForScrubbing(
  blob: Blob,
  opts: TranscodeOptions
): Promise<Blob> {
  const mb = await loadMediabunny();
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track");
    const srcW = await track.getDisplayWidth();
    const srcH = await track.getDisplayHeight();
    const scale = Math.min(1, opts.maxResolution / Math.min(srcW, srcH));
    const width = even(srcW * scale);
    const height = even(srcH * scale);
    const srcFps = (await track.computePacketStats(100)).averagePacketRate;

    // Encoding a keyframe every few frames is slow on hardware encoders
    // (measured ~40fps vs ~210fps in software for 720p in Chrome), so prefer
    // software when the browser has one.
    const software = await mb.canEncodeVideo("avc", {
      width,
      height,
      hardwareAcceleration: "prefer-software",
    });

    const target = new mb.BufferTarget();
    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: {
        width,
        height,
        fit: "fill",
        frameRate: srcFps > opts.maxFps + 0.5 ? opts.maxFps : undefined,
        keyFrameInterval: opts.keyframeInterval,
        codec: "avc",
        bitrate: mb.QUALITY_HIGH,
        hardwareAcceleration: software ? "prefer-software" : "no-preference",
        forceTranscode: true,
      },
      audio: { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const reason = conversion.discardedTracks.map((d) => d.reason).join(", ");
      throw new Error(`browser can't re-encode this video (${reason || "unknown"})`);
    }

    const onAbort = () => void conversion.cancel();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    if (opts.onProgress) conversion.onProgress = (p) => opts.onProgress!(p);
    try {
      await conversion.execute();
    } finally {
      opts.signal?.removeEventListener("abort", onAbort);
    }
    if (!target.buffer) throw new Error("transcode produced no output");
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
