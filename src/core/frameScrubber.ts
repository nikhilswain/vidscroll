export interface FrameScrubberOptions {
  canvas: HTMLCanvasElement;
  urls: string[] | ((index: number) => string);
  count?: number;
  fit?: "cover" | "contain";
  maxDpr?: number;
  concurrent?: number;
}

export interface FrameScrubber {
  draw(frameFloat: number): void;
  isReady(): boolean;
  loadedCount(): number;
  onProgress(cb: () => void): void;
  destroy(): void;
}

export function resolveFrameUrl(pattern: string): (index: number) => string {
  return (index: number) =>
    pattern.replace(/\{i(\d*)\}/g, (_match, pad: string) =>
      String(index).padStart(pad ? Number(pad) : 0, "0")
    );
}

export function createFrameScrubber(
  options: FrameScrubberOptions
): FrameScrubber {
  const canvas = options.canvas;
  const fit = options.fit ?? "cover";
  const maxDpr = options.maxDpr ?? 2;
  const concurrent = Math.max(1, options.concurrent ?? 12);
  const urls = options.urls;
  const count = Array.isArray(urls)
    ? urls.length
    : Math.max(0, options.count ?? 0);
  const urlOf = typeof urls === "function" ? urls : (i: number) => urls[i];
  if (count < 1) throw new Error("FrameScrubber needs at least one frame");

  const progressCbs: (() => void)[] = [];
  const ctx = canvas.getContext("2d");
  const images: (HTMLImageElement | null)[] = new Array(count).fill(null);
  let nextToLoad = 0;
  let inflight = 0;
  let loaded = 0;
  let ready = false;
  let destroyed = false;
  let cw = 1;
  let ch = 1;

  function fireProgress() {
    progressCbs.forEach((cb) => cb());
  }

  function maybeReady() {
    if (ready) return;
    const enough =
      images[0] != null &&
      (loaded >= Math.ceil(count * 0.1) ||
        (nextToLoad >= count && inflight === 0));
    if (enough) {
      ready = true;
      fireProgress();
    }
  }

  function pump() {
    while (!destroyed && inflight < concurrent && nextToLoad < count) {
      const i = nextToLoad++;
      const img = new Image();
      img.decoding = "async";
      inflight++;
      const settle = () => {
        if (destroyed) return;
        inflight--;
        if (!images[i] && img.complete && img.naturalWidth > 0) {
          images[i] = img;
          loaded++;
          maybeReady();
        }
        fireProgress();
        pump();
      };
      img.onload = settle;
      img.onerror = settle;
      img.src = urlOf(i);
      if (typeof img.decode === "function") img.decode().catch(() => {});
    }
  }

  function syncSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
  }

  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncSize) : null;
  ro?.observe(canvas);
  syncSize();

  function pickImage(i: number): HTMLImageElement | null {
    const j = Math.min(Math.max(i, 0), count - 1);
    if (images[j]) return images[j];
    for (let d = 1; d < count; d++) {
      if (images[j - d]) return images[j - d]!;
      if (images[j + d]) return images[j + d]!;
    }
    return null;
  }

  function drawScaled(src: HTMLImageElement, alpha: number) {
    const iw = src.naturalWidth;
    const ih = src.naturalHeight;
    if (!iw || !ih) return;
    const scale =
      fit === "cover"
        ? Math.max(cw / iw, ch / ih)
        : Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx!.globalAlpha = alpha;
    ctx!.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx!.globalAlpha = 1;
  }

  function draw(frameFloat: number) {
    if (destroyed || !ctx) return;
    syncSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const clamped = Math.min(Math.max(frameFloat, 0), count - 1);
    const i = Math.floor(clamped);
    const frac = clamped - i;
    const base = pickImage(i);
    if (!base) return;
    drawScaled(base, 1);
    if (frac > 0.001 && i + 1 < count) {
      const next = pickImage(i + 1);
      if (next && next !== base) drawScaled(next, frac);
    }
  }

  pump();

  return {
    draw,
    isReady: () => ready,
    loadedCount: () => loaded,
    onProgress(cb) {
      if (!destroyed) progressCbs.push(cb);
    },
    destroy() {
      destroyed = true;
      ro?.disconnect();
      progressCbs.length = 0;
      images.fill(null);
    },
  };
}
