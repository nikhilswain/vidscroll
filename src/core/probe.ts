export interface VideoProbe {
  /** Video track duration in seconds. */
  duration: number;
  width: number;
  height: number;
  frameCount: number;
  /** Largest gap between consecutive keyframes (or last keyframe → end), seconds. */
  maxKeyframeGap: number;
}

interface Box {
  type: string;
  start: number; // payload start
  end: number;
}

interface TrackInfo {
  id: number;
  isVideo: boolean;
  width: number;
  height: number;
  timescale: number;
  sampleDeltas: number[]; // per-sample durations from stts (regular MP4)
  syncSamples: Set<number> | null; // 1-based; null = every sample is a keyframe
  trexDuration: number;
  trexFlags: number;
}


function readBoxes(view: DataView, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let o = start;
  while (o + 8 <= end) {
    let size = view.getUint32(o);
    const type = String.fromCharCode(
      view.getUint8(o + 4),
      view.getUint8(o + 5),
      view.getUint8(o + 6),
      view.getUint8(o + 7)
    );
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(o + 8));
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header || o + size > end) break; // truncated or corrupt
    boxes.push({ type, start: o + header, end: o + size });
    o += size;
  }
  return boxes;
}

function child(view: DataView, box: Box, type: string): Box | undefined {
  return readBoxes(view, box.start, box.end).find((b) => b.type === type);
}

function parseTrak(view: DataView, trak: Box): TrackInfo | null {
  const tkhd = child(view, trak, "tkhd");
  const mdia = child(view, trak, "mdia");
  if (!tkhd || !mdia) return null;
  const tv = view.getUint8(tkhd.start);
  const id = view.getUint32(tkhd.start + (tv === 1 ? 20 : 12));
  const dimOffset = tkhd.start + (tv === 1 ? 88 : 76);
  const width = view.getUint32(dimOffset) / 65536;
  const height = view.getUint32(dimOffset + 4) / 65536;

  const hdlr = child(view, mdia, "hdlr");
  const handler = hdlr
    ? String.fromCharCode(
        ...[0, 1, 2, 3].map((i) => view.getUint8(hdlr.start + 8 + i))
      )
    : "";
  const mdhd = child(view, mdia, "mdhd");
  const mv = mdhd ? view.getUint8(mdhd.start) : 0;
  const timescale = mdhd ? view.getUint32(mdhd.start + (mv === 1 ? 20 : 12)) : 0;

  const stbl = (() => {
    const minf = child(view, mdia, "minf");
    return minf ? child(view, minf, "stbl") : undefined;
  })();
  const sampleDeltas: number[] = [];
  let syncSamples: Set<number> | null = null;
  if (stbl) {
    const stts = child(view, stbl, "stts");
    if (stts) {
      const n = view.getUint32(stts.start + 4);
      for (let i = 0; i < n; i++) {
        const count = view.getUint32(stts.start + 8 + i * 8);
        const delta = view.getUint32(stts.start + 12 + i * 8);
        for (let k = 0; k < count; k++) sampleDeltas.push(delta);
      }
    }
    const stss = child(view, stbl, "stss");
    if (stss) {
      syncSamples = new Set();
      const n = view.getUint32(stss.start + 4);
      for (let i = 0; i < n; i++) syncSamples.add(view.getUint32(stss.start + 8 + i * 4));
    }
  }
  return {
    id,
    isVideo: handler === "vide",
    width,
    height,
    timescale,
    sampleDeltas,
    syncSamples,
    trexDuration: 0,
    trexFlags: 0,
  };
}

/** sample_is_non_sync_sample bit of ISO BMFF sample flags. */
const isSyncFlags = (flags: number) => ((flags >>> 16) & 1) === 0;

/**
 * Read keyframe placement from an MP4/MOV file (regular or fragmented)
 * without decoding anything. Returns null for other containers or files it
 * can't make sense of — callers fall back to a full demuxer.
 */
export function probeMp4(buffer: ArrayBuffer): VideoProbe | null {
  try {
    const view = new DataView(buffer);
    const top = readBoxes(view, 0, buffer.byteLength);
    if (!top.some((b) => b.type === "ftyp" || b.type === "moov")) return null;
    const moov = top.find((b) => b.type === "moov");
    if (!moov) return null;

    const moovKids = readBoxes(view, moov.start, moov.end);
    const tracks = moovKids
      .filter((b) => b.type === "trak")
      .map((t) => parseTrak(view, t))
      .filter((t): t is TrackInfo => t != null);
    const video = tracks.find((t) => t.isVideo);
    if (!video || !video.timescale) return null;

    const mvex = moovKids.find((b) => b.type === "mvex");
    if (mvex) {
      for (const trex of readBoxes(view, mvex.start, mvex.end)) {
        if (trex.type !== "trex" || view.getUint32(trex.start + 4) !== video.id) continue;
        video.trexDuration = view.getUint32(trex.start + 12);
        video.trexFlags = view.getUint32(trex.start + 20);
      }
    }

    // Keyframe decode times, in track timescale units.
    const keyTimes: number[] = [];
    let time = 0;
    let frameCount = 0;

    video.sampleDeltas.forEach((delta, i) => {
      if (!video.syncSamples || video.syncSamples.has(i + 1)) keyTimes.push(time);
      time += delta;
      frameCount++;
    });

    // Fragmented MP4: samples live in moof/traf/trun boxes.
    for (const moof of top) {
      if (moof.type !== "moof") continue;
      for (const traf of readBoxes(view, moof.start, moof.end)) {
        if (traf.type !== "traf") continue;
        const kids = readBoxes(view, traf.start, traf.end);
        const tfhd = kids.find((b) => b.type === "tfhd");
        if (!tfhd || view.getUint32(tfhd.start + 4) !== video.id) continue;
        const tfFlags = view.getUint32(tfhd.start) & 0xffffff;
        let p = tfhd.start + 8;
        if (tfFlags & 0x1) p += 8; // base_data_offset
        if (tfFlags & 0x2) p += 4; // sample_description_index
        let defDuration = video.trexDuration;
        let defFlags = video.trexFlags;
        if (tfFlags & 0x8) {
          defDuration = view.getUint32(p);
          p += 4;
        }
        if (tfFlags & 0x10) p += 4; // default_sample_size
        if (tfFlags & 0x20) defFlags = view.getUint32(p);

        const tfdt = kids.find((b) => b.type === "tfdt");
        if (tfdt) {
          time =
            view.getUint8(tfdt.start) === 1
              ? Number(view.getBigUint64(tfdt.start + 4))
              : view.getUint32(tfdt.start + 4);
        }

        for (const trun of kids) {
          if (trun.type !== "trun") continue;
          const flags = view.getUint32(trun.start) & 0xffffff;
          const count = view.getUint32(trun.start + 4);
          let r = trun.start + 8;
          if (flags & 0x1) r += 4; // data_offset
          let firstFlags: number | null = null;
          if (flags & 0x4) {
            firstFlags = view.getUint32(r);
            r += 4;
          }
          for (let i = 0; i < count; i++) {
            let duration = defDuration;
            let sampleFlags = defFlags;
            if (flags & 0x100) {
              duration = view.getUint32(r);
              r += 4;
            }
            if (flags & 0x200) r += 4; // size
            if (flags & 0x400) {
              sampleFlags = view.getUint32(r);
              r += 4;
            }
            if (flags & 0x800) r += 4; // composition offset
            if (i === 0 && firstFlags != null) sampleFlags = firstFlags;
            if (isSyncFlags(sampleFlags)) keyTimes.push(time);
            time += duration;
            frameCount++;
          }
        }
      }
    }

    if (!frameCount || !keyTimes.length) return null;
    let maxGap = time - keyTimes[keyTimes.length - 1];
    for (let i = 1; i < keyTimes.length; i++) {
      maxGap = Math.max(maxGap, keyTimes[i] - keyTimes[i - 1]);
    }
    return {
      duration: time / video.timescale,
      width: video.width,
      height: video.height,
      frameCount,
      maxKeyframeGap: maxGap / video.timescale,
    };
  } catch {
    return null;
  }
}
