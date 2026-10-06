import { createEngine } from "./engine";
import { loadScrollVideo } from "./load";
import type { LoadPhase, LoadedVideo, OptimizeOptions } from "./load";
import { acquireSmoothScroll } from "./smoothScroll";
import type { SmoothScrollOptions } from "./smoothScroll";
import { VidscrollError, checkSourceUrl, warnOnce } from "./source";
import type {
  EngineAPI,
  EngineEvent,
  EngineEventMap,
  EngineOptions,
  EngineStateSnapshot,
  ScrollToOptionsLite,
  ScrollVideoApi,
  SectionDescriptor,
} from "./types";

export interface LoaderState {
  phase: "download" | "optimize" | "preparing" | "error";
  progress: number;
  background: boolean;
  error?: Error;
}

export interface ScrollVideoOptions
  extends Omit<EngineOptions, "video" | "frames" | "container" | "stage" | "preview"> {
  src: string;
  optimize?: boolean | OptimizeOptions;
  smoothScroll?: boolean | SmoothScrollOptions;
  fullPreload?: boolean;
  onLoad?: (info: Pick<LoadedVideo, "source" | "probe">) => void;
  onError?: (error: Error) => void;
  fit?: "cover" | "contain";
  poster?: string | false;
}

export interface ScrollVideoEventMap extends EngineEventMap {
  loader: LoaderState | null;
}

export type ScrollVideoEvent = keyof ScrollVideoEventMap;

export interface ScrollVideoController extends Omit<ScrollVideoApi, "on" | "off"> {
  on<K extends ScrollVideoEvent>(evt: K, handler: (payload: ScrollVideoEventMap[K]) => void): void;
  off<K extends ScrollVideoEvent>(evt: K, handler: (payload: ScrollVideoEventMap[K]) => void): void;
  getLoader(): LoaderState | null;
  update(options: ScrollVideoOptions): void;
  destroy(): void;
}

interface Media {
  url: string;
  engineKey: number;
  preview: boolean;
  release: () => void;
}

interface Slots {
  active: Media | null;
  next: Media | null;
}

interface Pipeline {
  phase: LoadPhase;
  progress: number;
}

interface SwapRun {
  engine: EngineAPI | null;
  ready: boolean;
  next: Media | null;
  cancelled: boolean;
}

const EMPTY: Slots = { active: null, next: null };

const ENGINE_EVENTS: EngineEvent[] = ["ready", "update", "warmup", "sectionEnter", "sectionExit", "resize"];

const IDLE_STATE: EngineStateSnapshot = {
  linearProgress: 0,
  time: 0,
  frameIndex: 0,
  totalFrames: 0,
  duration: 0,
  activeSections: [],
};

export const INITIAL_LOADER: LoaderState = { phase: "download", progress: 0, background: false };

export function previewSource(src: string): string | null {
  try {
    checkSourceUrl(src);
  } catch {
    return null;
  }
  return src.includes("#") ? src : `${src}#t=0.001`;
}

export function bindProgressVariable(engine: ScrollVideoApi, el: HTMLElement): () => void {
  let last = -1;
  const apply = (s: EngineStateSnapshot) => {
    if (Math.abs(s.linearProgress - last) < 0.0001) return;
    last = s.linearProgress;
    el.style.setProperty("--video-progress", s.linearProgress.toFixed(4));
  };
  apply(engine.getState());
  engine.on("update", apply);
  return () => engine.off("update", apply);
}

function loaderState(
  error: Error | null,
  hasVideo: boolean,
  ready: boolean,
  warmup: number,
  pipeline: Pipeline | null,
  swapping: boolean
): LoaderState | null {
  if (error) return { phase: "error", progress: 0, background: false, error };
  if (!hasVideo) return { phase: pipeline?.phase ?? "download", progress: pipeline?.progress ?? 0, background: false };
  if (!ready) return { phase: "preparing", progress: warmup, background: false };
  if (pipeline) return { ...pipeline, background: true };
  if (swapping) return { phase: "optimize", progress: 1, background: true };
  return null;
}

const sameLoader = (a: LoaderState | null, b: LoaderState | null) =>
  a === b ||
  (a != null &&
    b != null &&
    a.phase === b.phase &&
    a.progress === b.progress &&
    a.background === b.background &&
    a.error === b.error);

function createVideo(fit: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.setAttribute("data-vidscroll-media", "");
  video.setAttribute("data-fit", fit);
  video.muted = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("preload", "auto");
  return video;
}

export function createScrollVideo(
  { container, stage }: { container: HTMLElement; stage: HTMLElement },
  initial: ScrollVideoOptions
): ScrollVideoController {
  let opts = initial;
  let slots: Slots = EMPTY;
  let pipeline: Pipeline | null = { phase: "download", progress: 0 };
  let error: Error | null = null;
  let ready = false;
  let warmupProgress = 0;
  let engine: EngineAPI | null = null;
  let engineKey: number | undefined;
  let engineCleanup: (() => void) | null = null;
  let engineCounter = 0;
  let swap: SwapRun | null = null;
  let loadAbort: AbortController | null = null;
  let owned: LoadedVideo[] = [];
  let releaseSmoothScroll: (() => void) | null = null;
  let destroyed = false;
  let loader: LoaderState | null = INITIAL_LOADER;
  const sections = new Map<string, SectionDescriptor>();
  const listeners = new Map<ScrollVideoEvent, Set<(payload: never) => void>>();

  function emit<K extends ScrollVideoEvent>(evt: K, payload: ScrollVideoEventMap[K]) {
    listeners.get(evt)?.forEach((handler) => (handler as (p: ScrollVideoEventMap[K]) => void)(payload));
  }

  const fit = () => opts.fit ?? "cover";
  const fullPreload = () => opts.fullPreload ?? true;
  const smoothOn = () => !!opts.smoothScroll;

  let activeEl =
    stage.querySelector<HTMLVideoElement>(
      ":scope > video[data-vidscroll-media]:not([data-vidscroll-preview]):not([data-vidscroll-next])"
    ) ?? createVideo(fit());
  let activeUrl = "";
  let nextEl: HTMLVideoElement | null = null;
  let nextUrl: string | null = null;
  let previewEl = stage.querySelector<HTMLVideoElement>(":scope > video[data-vidscroll-preview]");

  activeEl.removeAttribute("src");
  if (activeEl.parentNode !== stage) stage.insertBefore(activeEl, stage.firstChild);
  applyPoster();
  attachActive(activeEl);

  function applyPoster() {
    if (opts.poster) activeEl.setAttribute("poster", opts.poster);
    else activeEl.removeAttribute("poster");
  }

  function onActiveError() {
    failPlayback(activeEl.error?.message || "unsupported format or codec");
  }

  function onActiveMetadata() {
    const duration = activeEl.duration ?? 0;
    if (!(duration > 0 && Number.isFinite(duration))) failPlayback("its duration is unknown, so it can't seek");
  }

  function attachActive(el: HTMLVideoElement) {
    el.addEventListener("error", onActiveError);
    el.addEventListener("loadedmetadata", onActiveMetadata);
  }

  function detachActive(el: HTMLVideoElement) {
    el.removeEventListener("error", onActiveError);
    el.removeEventListener("loadedmetadata", onActiveMetadata);
  }

  function replaceActive(el: HTMLVideoElement) {
    detachActive(activeEl);
    activeEl.remove();
    activeEl = el;
    applyPoster();
    attachActive(el);
    if (el.parentNode !== stage || el !== stage.firstChild) stage.insertBefore(el, stage.firstChild);
  }

  function showActive(url: string) {
    if (url === activeUrl) return;
    const promoted = nextEl && url === nextUrl ? nextEl : null;
    if (promoted) {
      promoted.removeAttribute("data-vidscroll-next");
      promoted.removeAttribute("aria-hidden");
      nextEl = null;
      nextUrl = null;
      replaceActive(promoted);
    } else if (!activeUrl && url) {
      activeEl.src = url;
    } else {
      const el = createVideo(fit());
      if (url) el.src = url;
      replaceActive(el);
    }
    activeUrl = url;
  }

  function showNext(url: string | null) {
    if (url === nextUrl) return;
    nextEl?.remove();
    nextEl = null;
    nextUrl = url;
    if (!url) return;
    const el = createVideo(fit());
    el.setAttribute("data-vidscroll-next", "");
    el.setAttribute("aria-hidden", "true");
    el.src = url;
    stage.insertBefore(el, activeEl.nextSibling);
    nextEl = el;
  }

  function syncPreview() {
    const src = previewSource(opts.src);
    const show =
      opts.poster === undefined &&
      fullPreload() &&
      src != null &&
      loader != null &&
      !loader.background &&
      loader.phase !== "error";
    if (!show || !src) {
      previewEl?.remove();
      previewEl = null;
      return;
    }
    if (!previewEl) {
      previewEl = createVideo(fit());
      previewEl.setAttribute("data-vidscroll-preview", "");
      previewEl.setAttribute("preload", "metadata");
      previewEl.setAttribute("aria-hidden", "true");
    }
    if (previewEl.getAttribute("src") !== src) previewEl.src = src;
    const anchor = nextEl ?? activeEl;
    if (previewEl.previousSibling !== anchor) stage.insertBefore(previewEl, anchor.nextSibling);
  }

  function render() {
    if (destroyed) return;
    const next = loaderState(error, slots.active != null, ready, warmupProgress, pipeline, slots.next != null);
    const changed = !sameLoader(loader, next);
    if (changed) loader = next;
    syncPreview();
    if (changed) emit("loader", loader);
  }

  function stopEngine() {
    const previous = engine;
    if (!previous) return;
    engineCleanup?.();
    engineCleanup = null;
    const wasActive = previous.getState().activeSections;
    previous.destroy();
    engine = null;
    ready = false;
    warmupProgress = 0;
    if (destroyed) return;
    for (const id of wasActive) emit("sectionExit", { id, state: IDLE_STATE });
    emit("update", IDLE_STATE);
  }

  function startEngine() {
    stopEngine();
    const media = slots.active;
    engineKey = media?.engineKey;
    if (!media) return;
    const created = createEngine({
      video: activeEl,
      container,
      stage,
      length: opts.length,
      fps: opts.fps,
      easing: opts.easing,
      smoothingTauMs: opts.smoothingTauMs ?? (smoothOn() ? 35 : undefined),
      warmup: opts.warmup,
      preview: media.preview,
      debug: opts.debug,
      onDebug: opts.onDebug,
    });
    engine = created;
    const onWarmup = (p: { value: number }) => {
      warmupProgress = p.value;
      render();
    };
    const onReady = () => {
      ready = true;
      render();
      syncSwap();
    };
    created.on("warmup", onWarmup);
    created.on("ready", onReady);
    const forwarders = ENGINE_EVENTS.map((evt) => {
      const forward = (payload: EngineEventMap[typeof evt]) => emit(evt, payload);
      created.on(evt, forward);
      return () => created.off(evt, forward);
    });
    const unbindProgress = bindProgressVariable(created, container);
    engineCleanup = () => {
      created.off("warmup", onWarmup);
      created.off("ready", onReady);
      forwarders.forEach((off) => off());
      unbindProgress();
    };
    for (const desc of sections.values()) created.addSection(desc);
    if (created.isReady()) ready = true;
    emit("update", created.getState());
  }

  function setSlots(next: Slots) {
    if (destroyed) return;
    const previous = slots;
    slots = next;
    const kept = [next.active?.url, next.next?.url];
    for (const media of [previous.active, previous.next]) {
      if (media && !kept.includes(media.url)) media.release();
    }
    showActive(next.active?.url ?? "");
    showNext(next.next?.url ?? null);
    if (next.active?.engineKey !== engineKey) startEngine();
    render();
    syncSwap();
  }

  function syncSwap() {
    if (destroyed) return;
    const next = slots.next;
    if (swap && swap.engine === engine && swap.ready === ready && swap.next === next) return;
    if (swap) swap.cancelled = true;
    const run: SwapRun = { engine, ready, next, cancelled: false };
    swap = run;
    if (!engine || !ready || !next || !nextEl) return;
    const src = opts.src;
    engine.swapVideo(nextEl).then(
      () => {
        if (run.cancelled) return;
        if (slots.next === next && slots.active) {
          setSlots({ active: { ...next, engineKey: slots.active.engineKey }, next: null });
        }
      },
      (err: Error) => {
        if (run.cancelled) return;
        warnOnce(`[vidscroll] Couldn't switch to the optimized copy of "${src}" (${err.message}); keeping the original.`);
        if (slots.next === next) setSlots({ active: slots.active, next: null });
      }
    );
  }

  function fail(err: Error) {
    console.error(err);
    error = err;
    render();
    opts.onError?.(err);
  }

  function failPlayback(reason: string) {
    const { active, next } = slots;
    if (!active) return;
    if (next) {
      setSlots({ active: { ...next, engineKey: ++engineCounter }, next: null });
      return;
    }
    if (active.preview && pipeline) {
      setSlots(EMPTY);
      return;
    }
    const src = opts.src;
    if (active.url !== src) {
      warnOnce(`[vidscroll] This browser couldn't use the downloaded copy of "${src}" (${reason}); streaming it instead.`);
      setSlots({ active: { url: src, engineKey: ++engineCounter, preview: false, release() {} }, next: null });
      return;
    }
    fail(
      new VidscrollError(
        "unplayable",
        `[vidscroll] This browser can't scrub "${src}" (${reason}). Preparing it with \`npx vidscroll encode\` produces a standard MP4 that plays everywhere.`
      )
    );
  }

  function abortLoad() {
    loadAbort?.abort();
    loadAbort = null;
    owned.forEach((video) => video.release());
    owned = [];
  }

  function load() {
    abortLoad();
    const controller = new AbortController();
    loadAbort = controller;
    const src = opts.src;
    const toMedia = (video: LoadedVideo, preview: boolean): Media => ({
      url: video.url,
      engineKey: ++engineCounter,
      preview,
      release: video.release,
    });
    const stream: LoadedVideo = { url: src, source: "stream", probe: null, release() {} };
    const reportLoad = (video: LoadedVideo) => opts.onLoad?.({ source: video.source, probe: video.probe });
    error = null;

    if (!fullPreload()) {
      pipeline = null;
      setSlots({ active: toMedia(stream, false), next: null });
      reportLoad(stream);
      return;
    }

    pipeline = { phase: "download", progress: 0 };
    setSlots(EMPTY);
    const optimize = opts.optimize;
    const wait = typeof optimize === "object" && optimize.wait === true;
    let preview: LoadedVideo | null = null;
    loadScrollVideo(src, {
      optimize,
      signal: controller.signal,
      onProgress: (phase, progress) => {
        const rounded = Math.round(progress * 100) / 100;
        if (controller.signal.aborted || (pipeline && phase === pipeline.phase && rounded === pipeline.progress)) return;
        pipeline = { phase, progress: rounded };
        render();
      },
      onPreview: wait
        ? undefined
        : (original) => {
            preview = original;
            owned.push(original);
            setSlots({ active: toMedia(original, true), next: null });
          },
    }).then(
      (result) => {
        if (controller.signal.aborted) return result.release();
        pipeline = null;
        reportLoad(result);
        if (result === preview) {
          if (slots.active) render();
          else setSlots({ active: toMedia(stream, false), next: null });
          return;
        }
        owned.push(result);
        const media = toMedia(result, false);
        setSlots(slots.active ? { active: slots.active, next: media } : { active: media, next: null });
      },
      (err: Error) => {
        if (controller.signal.aborted) return;
        fail(err);
      }
    );
  }

  function syncSmoothScroll() {
    releaseSmoothScroll?.();
    releaseSmoothScroll = null;
    const o = opts.smoothScroll;
    if (o) releaseSmoothScroll = acquireSmoothScroll(o !== true ? o : undefined);
  }

  syncSmoothScroll();
  load();

  return {
    update(next) {
      if (destroyed) return;
      const prev = opts;
      opts = next;
      const prevSmooth = !!prev.smoothScroll;
      if (prevSmooth !== smoothOn()) syncSmoothScroll();
      if ((prev.fit ?? "cover") !== fit()) {
        for (const el of [activeEl, nextEl, previewEl]) el?.setAttribute("data-fit", fit());
      }
      if (prev.poster !== next.poster) applyPoster();
      if (prev.src !== next.src || (prev.fullPreload ?? true) !== fullPreload()) {
        load();
      } else if (String(prev.length ?? "auto") !== String(next.length ?? "auto") || prevSmooth !== smoothOn()) {
        startEngine();
        render();
        syncSwap();
      } else {
        render();
      }
    },
    getLoader: () => loader,
    on(evt, handler) {
      let set = listeners.get(evt);
      if (!set) listeners.set(evt, (set = new Set()));
      set.add(handler as (payload: never) => void);
    },
    off(evt, handler) {
      listeners.get(evt)?.delete(handler as (payload: never) => void);
    },
    getState: () => engine?.getState() ?? { ...IDLE_STATE },
    isReady: () => engine?.isReady() ?? false,
    scrollToProgress(progress: number, opts?: ScrollToOptionsLite) {
      engine?.scrollToProgress(progress, opts);
    },
    scrollToTime(seconds: number, opts?: ScrollToOptionsLite) {
      engine?.scrollToTime(seconds, opts);
    },
    getSectionProgress: (id: string) => engine?.getSectionProgress(id) ?? 0,
    addSection(desc: SectionDescriptor) {
      if (sections.has(desc.id)) throw new Error(`Section id already exists: ${desc.id}`);
      sections.set(desc.id, desc);
      engine?.addSection(desc);
    },
    removeSection(id: string) {
      sections.delete(id);
      engine?.removeSection(id);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (swap) swap.cancelled = true;
      abortLoad();
      stopEngine();
      releaseSmoothScroll?.();
      releaseSmoothScroll = null;
      detachActive(activeEl);
      for (const el of [activeEl, nextEl, previewEl]) el?.remove();
      listeners.clear();
    },
  };
}
