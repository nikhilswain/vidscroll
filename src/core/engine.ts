import type {
  EngineOptions,
  EngineAPI,
  EngineStateSnapshot,
  SectionDescriptor,
  NormalizedSection,
  EngineEvent,
  EngineEventHandler,
  EngineEventMap,
} from "./types";

const DEFAULT_FPS = 30;
const DEFAULT_PPF = 12;
const DEFAULT_BUFFER = 2;
const DEFAULT_TAU_MS = 100; // smoothing time constant; lag stays ~constant
const TIME_EPSILON_S = 0.001; // skip seeks below 1ms of change
const PROGRESS_EPSILON = 0.0005;
const MAX_TICK_DT_MS = 250; // clamp one smoothing step (throttled tabs, stalls)
const FRAME_WAIT_TIMEOUT_MS = 300; // stall safety if no paint callback arrives
const PRIME_MAX_SAMPLES = 6;
const PRIME_MIN_SAMPLES = 3;
const PRIME_TIMEOUT_MS = 600;

type RVFCMeta = { mediaTime: number; presentedFrames: number };
type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, meta: RVFCMeta) => void
  ) => number;
};

type ListenerSets = { [K in EngineEvent]: Set<EngineEventHandler<K>> };

/**
 * Scroll-scrub engine. Two output modes:
 * - video: the element stays paused; scroll maps to a target time and the
 *   engine seeks one painted frame at a time, paced by requestVideoFrameCallback
 *   (rAF + "seeked" fallback) so the decoder never has a seek backlog.
 * - frames: a canvas FrameRenderer draws per tick at display rate — no decoder
 *   in the path at all.
 */
export function createEngine(options: EngineOptions): EngineAPI {
  const pixelsPerFrame = options.pixelsPerFrame ?? DEFAULT_PPF;
  const bufferFrames = options.bufferFrames ?? DEFAULT_BUFFER;
  const scrollTarget: Window | HTMLElement = options.scrollTarget || window;
  const minScrollHeight = options.minScrollHeight ?? 1200;
  const easingFn = options.easing || ((t: number) => t);
  const tauMs = options.smoothingTauMs ?? DEFAULT_TAU_MS;
  const warmupEnabled = options.warmup !== false;
  const warmupStepsOpt = typeof options.warmup === "number" ? options.warmup : 0;
  const debug = options.debug === true;
  const debugCb = options.onDebug;

  const frames = options.frames ?? null;
  const framesMode = frames != null;
  const videoEl = options.video ?? null;
  if (!videoEl && !frames)
    throw new Error("Engine requires a video element or a frame renderer");
  const vWith = (videoEl ?? undefined) as VideoWithRVFC | undefined;
  const hasRVFC = typeof vWith?.requestVideoFrameCallback === "function";

  let fps = options.fps ?? DEFAULT_FPS;
  let duration = 0;
  let totalFrames = 0;
  let spacerEl: HTMLDivElement | null = options.spacer ?? null;

  let targetProgress = 0; // raw scroll position, 0..1
  let smoothedProgress = 0; // time-smoothed chase value
  let lastTickTime = 0;

  let tickPending = false;
  let tickRafId = 0;
  let scrollRafPending = false;

  let seekInFlight = false;
  let frameWaitActive = false;
  let frameWaitTimeoutId = 0;

  let readyEmitted = false;

  // One-time first-decode prime (mobile browsers won't paint a seek until a
  // frame has decoded); doubles as an fps measurement window.
  let primed = false;
  let priming = false;
  let primeSamples: number[] = [];
  let lastPrimeMediaTime = -1;
  let primeTimeoutId = 0;

  // Load-time warm-up: sweep seeks across the timeline so the first user
  // scroll lands on pre-touched data instead of a cold decode.
  let warming = false;
  let warmupIndex = 0;
  let warmupTotal = 0;

  let destroyed = false;

  const sections = new Map<string, NormalizedSection>();
  // Raw descriptors: time/frame ranges need the duration, which may arrive
  // after registration, so sections are re-normalized when it changes.
  const sectionDescs = new Map<string, SectionDescriptor>();
  const listeners: ListenerSets = {
    ready: new Set(),
    update: new Set(),
    warmup: new Set(),
    sectionEnter: new Set(),
    sectionExit: new Set(),
    resize: new Set(),
  };

  const state: EngineStateSnapshot = {
    linearProgress: 0,
    frameIndex: 0,
    totalFrames: 0,
    duration: 0,
    activeSections: [],
  };

  function emit<K extends EngineEvent>(evt: K, payload: EngineEventMap[K]) {
    (listeners[evt] as Set<EngineEventHandler<K>>).forEach((cb) => cb(payload));
  }

  function debugLog(evt: string, data: Record<string, unknown>) {
    if (!debug) return;
    console.log(`[scroll-video] ${evt}`, data);
    debugCb?.({ evt, ...data });
  }

  function recomputeDerived() {
    if (framesMode && frames) {
      duration = 0;
      totalFrames = Math.max(1, frames.count);
    } else {
      duration = videoEl!.duration || 0;
      totalFrames = Math.max(1, Math.round(duration * fps));
    }
    state.totalFrames = totalFrames;
    state.duration = duration;
    sectionDescs.forEach((desc, id) => {
      const next = normalizeSection(desc);
      next._active = sections.get(id)?._active;
      sections.set(id, next);
    });
    if (spacerEl) {
      const scrollLength = Math.max(
        (totalFrames + bufferFrames) * pixelsPerFrame + window.innerHeight,
        minScrollHeight
      );
      spacerEl.style.height = scrollLength + "px";
    }
  }

  // --- scroll → target progress -------------------------------------------

  function readScrollIntoTarget() {
    const maxScrollable =
      ((spacerEl?.scrollHeight ?? 0) || document.body.scrollHeight) -
      window.innerHeight;
    const y =
      scrollTarget === window
        ? window.scrollY
        : (scrollTarget as HTMLElement).scrollTop;
    targetProgress =
      maxScrollable > 0 ? Math.min(Math.max(y / maxScrollable, 0), 1) : 0;
    debugLog("scroll", { y, maxScrollable, targetProgress });
  }

  function updateTargetProgress() {
    scrollRafPending = false;
    if (destroyed) return;
    readScrollIntoTarget();
    requestTick();
  }

  function scheduleScrollRead() {
    if (destroyed) return;
    if (!scrollRafPending) {
      scrollRafPending = true;
      requestAnimationFrame(updateTargetProgress);
    }
  }

  // --- video loop -----------------------------------------------------------

  function requestTick() {
    if (destroyed || tickPending) return;
    if (!framesMode && duration <= 0) return;
    tickPending = true;
    tickRafId = requestAnimationFrame(tick);
  }

  function applyEasing(p: number) {
    let eased = easingFn(p);
    // Keep the final frame reachable when easing flattens near 1.
    if (eased > 0.99) {
      const tailPortion = (eased - 0.99) / 0.01;
      eased = 0.99 + tailPortion * (p - 0.99);
    }
    return Math.min(Math.max(eased, 0), 1);
  }

  function tick(now: number) {
    tickPending = false;
    if (destroyed) return;
    if (!framesMode && duration <= 0) return;

    // Time-based exponential smoothing: constant lag regardless of tick rate,
    // identical behavior scrolling up and down.
    const dt =
      lastTickTime > 0 ? Math.min(now - lastTickTime, MAX_TICK_DT_MS) : 16.7;
    lastTickTime = now;
    const alpha = 1 - Math.exp(-dt / tauMs);
    smoothedProgress += (targetProgress - smoothedProgress) * alpha;
    if (Math.abs(targetProgress - smoothedProgress) < PROGRESS_EPSILON) {
      smoothedProgress = targetProgress;
    }

    if (framesMode && frames) {
      const frameFloat = applyEasing(smoothedProgress) * (totalFrames - 1);
      state.linearProgress = smoothedProgress;
      state.frameIndex = Math.min(
        totalFrames - 1,
        Math.max(0, Math.round(frameFloat))
      );
      updateSections();
      frames.draw(frameFloat);
      emit("update", { ...state });
      if (smoothedProgress === targetProgress) {
        lastTickTime = 0; // converged; next burst starts fresh
        return;
      }
      requestTick();
      return;
    }

    const targetTime = applyEasing(smoothedProgress) * duration;
    const frame = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round((targetTime / duration) * (totalFrames - 1)))
    );
    state.linearProgress = smoothedProgress;
    state.frameIndex = frame;
    updateSections();
    emit("update", { ...state });

    // Never issue a new seek while the previous one is still painting.
    if (
      !priming &&
      !warming &&
      !seekInFlight &&
      !videoEl!.seeking &&
      Math.abs(videoEl!.currentTime - targetTime) > TIME_EPSILON_S
    ) {
      seekInFlight = true;
      videoEl!.currentTime = targetTime;
      armFrameWait();
      debugLog("seek", { targetTime, current: videoEl!.currentTime });
    }

    const settled = smoothedProgress === targetProgress && !seekInFlight;
    if (settled) {
      lastTickTime = 0; // next scroll burst starts with a fresh dt
      return;
    }
    if (!seekInFlight) requestTick(); // still smoothing at display rate
    // else: next tick fires from onFrameDone once this seek paints
  }

  function armFrameWait() {
    if (frameWaitActive) return;
    frameWaitActive = true;
    if (hasRVFC && vWith) vWith.requestVideoFrameCallback!(onFrameDone);
    frameWaitTimeoutId = window.setTimeout(onFrameDone, FRAME_WAIT_TIMEOUT_MS);
  }

  function onFrameDone() {
    if (!frameWaitActive) return;
    frameWaitActive = false;
    if (frameWaitTimeoutId) {
      clearTimeout(frameWaitTimeoutId);
      frameWaitTimeoutId = 0;
    }
    seekInFlight = false;
    if (!destroyed) requestTick();
  }

  // Fallback paint signal when rVFC is unavailable ("seeked" = decode done).
  function onSeeked() {
    if (destroyed) return;
    if (warming) {
      warmupIndex++;
      stepWarmup();
      return;
    }
    if (!hasRVFC && frameWaitActive) onFrameDone();
  }

  // --- first-decode prime + fps measurement --------------------------------

  function prime() {
    if (primed || destroyed || !videoEl) return;
    primed = true;
    // Some mobile browsers won't paint any seeked frame until the element has
    // decoded once; a brief muted play also exposes real frame cadence via rVFC.
    priming = true;
    primeSamples = [];
    lastPrimeMediaTime = -1;
    if (hasRVFC && vWith) vWith.requestVideoFrameCallback!(onPrimeFrame);
    primeTimeoutId = window.setTimeout(finishPrime, PRIME_TIMEOUT_MS);
    videoEl.play().catch(() => finishPrime());
  }

  function onPrimeFrame(_now: number, meta: RVFCMeta) {
    if (!priming || destroyed) return;
    if (lastPrimeMediaTime >= 0) {
      const d = meta.mediaTime - lastPrimeMediaTime;
      if (d > 0.001 && d < 0.1) primeSamples.push(d);
    }
    lastPrimeMediaTime = meta.mediaTime;
    if (primeSamples.length >= PRIME_MAX_SAMPLES) return finishPrime();
    if (vWith) vWith.requestVideoFrameCallback!(onPrimeFrame);
  }

  function finishPrime() {
    if (!priming || !videoEl) return;
    priming = false;
    if (primeTimeoutId) {
      clearTimeout(primeTimeoutId);
      primeTimeoutId = 0;
    }
    try {
      videoEl.pause();
      videoEl.playbackRate = 1;
    } catch {
      /* ignore */
    }
    if (primeSamples.length >= PRIME_MIN_SAMPLES) {
      primeSamples.sort((a, b) => a - b);
      const median = primeSamples[Math.floor(primeSamples.length / 2)];
      const measured = Math.round(1 / median);
      if (measured >= 15 && measured <= 120 && Math.abs(measured - fps) > 0.5) {
        fps = measured;
        recomputeDerived();
        debugLog("fps", { fps });
      }
    }
    lastTickTime = 0;
    beginWarmup();
  }

  // --- load-time warm-up sweep ----------------------------------------------

  function beginWarmup() {
    if (destroyed) return;
    if (!warmupEnabled || !videoEl) return emitReadyNow();
    warming = true;
    warmupIndex = 0;
    warmupTotal =
      warmupStepsOpt > 0
        ? warmupStepsOpt
        : Math.round(Math.min(48, Math.max(12, duration / 2.5)));
    stepWarmup();
  }

  function stepWarmup() {
    if (destroyed || !videoEl) return;
    if (warmupIndex >= warmupTotal) return finishWarmup();
    emit("warmup", { value: warmupIndex / warmupTotal });
    // Seek across the whole timeline, midpoints of even slices.
    videoEl.currentTime = (duration * (warmupIndex + 0.5)) / warmupTotal;
    // onSeeked advances to the next step.
  }

  function finishWarmup() {
    if (!warming) return;
    warming = false;
    emit("warmup", { value: 1 });
    emitReadyNow();
  }

  function emitReadyNow() {
    if (destroyed || readyEmitted) return;
    readyEmitted = true;
    emit("ready", { ...state });
    lastTickTime = 0;
    requestTick();
  }

  // --- sections -------------------------------------------------------------

  function updateSections() {
    const newlyActive: string[] = [];
    sections.forEach((sec) => {
      const active =
        state.linearProgress >= sec.start && state.linearProgress < sec.end;
      if (active && !sec._active) {
        sec._active = true;
        emit("sectionEnter", { id: sec.id, state: { ...state } });
      } else if (!active && sec._active) {
        sec._active = false;
        emit("sectionExit", { id: sec.id, state: { ...state } });
      }
      if (sec._active) newlyActive.push(sec.id);
    });
    state.activeSections = newlyActive;
  }

  function normalizeSection(desc: SectionDescriptor): NormalizedSection {
    // Priority: explicit start/end > times > frames
    let start = desc.start;
    let end = desc.end;
    if (start == null && desc.fromTime != null && duration > 0)
      start = desc.fromTime / duration;
    if (end == null && desc.toTime != null && duration > 0)
      end = desc.toTime / duration;
    if (start == null && desc.fromFrame != null && totalFrames > 0)
      start = desc.fromFrame / totalFrames;
    if (end == null && desc.toFrame != null && totalFrames > 0)
      end = desc.toFrame / totalFrames;
    if (start == null) start = 0;
    if (end == null) end = 1;
    start = Math.min(Math.max(start, 0), 1);
    end = Math.min(Math.max(end, 0), 1);
    if (end <= start) end = Math.min(1, start + 0.0001);
    return { id: desc.id, start, end, mode: desc.mode || "normal", data: desc.data };
  }

  // --- lifecycle ------------------------------------------------------------

  function attachSpacer(el: HTMLDivElement) {
    spacerEl = el;
    // Provisional height so the page is scrollable before metadata arrives.
    if (!el.style.height) {
      el.style.height =
        Math.max(minScrollHeight, window.innerHeight * 3) + "px";
    }
    recomputeDerived();
  }

  function onMetadata() {
    if (destroyed || !videoEl) return;
    recomputeDerived();
    readScrollIntoTarget();
    smoothedProgress = targetProgress; // snap on first sync
    // "ready" fires after prime + warm-up complete; see emitReadyNow.
    if (videoEl.readyState < 2) prime();
    else beginWarmup();
  }

  function onResize() {
    if (destroyed) return;
    recomputeDerived();
    emit("resize", { ...state });
    readScrollIntoTarget(); // maxScrollable changed
    requestTick();
  }

  function removeListeners() {
    if (videoEl) {
      videoEl.removeEventListener("loadedmetadata", onMetadata);
      videoEl.removeEventListener("seeked", onSeeked);
    }
    window.removeEventListener("resize", onResize);
    if (scrollTarget instanceof Window) {
      scrollTarget.removeEventListener("scroll", scheduleScrollRead);
    } else {
      scrollTarget.removeEventListener("scroll", scheduleScrollRead);
    }
  }

  const api: EngineAPI = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (tickRafId) cancelAnimationFrame(tickRafId);
      if (frameWaitTimeoutId) clearTimeout(frameWaitTimeoutId);
      if (primeTimeoutId) clearTimeout(primeTimeoutId);
      priming = false;
      removeListeners();
      if (videoEl) {
        try {
          videoEl.pause();
          videoEl.playbackRate = 1;
        } catch {
          /* ignore */
        }
      }
      if (debug) {
        delete (window as unknown as Record<string, unknown>)
          .__scrollVideoEngine;
      }
    },
    getState() {
      return { ...state };
    },
    isReady() {
      return readyEmitted;
    },
    // Frames mode: the renderer is async and external; when it can draw it
    // calls this and the engine does its first sync + emit.
    notifyReady() {
      if (destroyed || readyEmitted) return;
      readyEmitted = true;
      recomputeDerived();
      readScrollIntoTarget();
      smoothedProgress = targetProgress; // snap on first sync
      emit("ready", { ...state });
      requestTick();
    },
    on<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>) {
      listeners[evt].add(handler as EngineEventHandler<typeof evt>);
    },
    off<K extends EngineEvent>(evt: K, handler: EngineEventHandler<K>) {
      listeners[evt].delete(handler as EngineEventHandler<typeof evt>);
    },
    registerSection(desc: SectionDescriptor) {
      if (sections.has(desc.id))
        throw new Error(`Section id already exists: ${desc.id}`);
      sectionDescs.set(desc.id, desc);
      sections.set(desc.id, normalizeSection(desc));
      updateSections();
    },
    unregisterSection(id: string) {
      sections.delete(id);
      sectionDescs.delete(id);
      updateSections();
    },
  };

  // Listeners
  window.addEventListener("resize", onResize);
  if (scrollTarget instanceof Window) {
    scrollTarget.addEventListener("scroll", scheduleScrollRead, {
      passive: true,
    });
  } else {
    scrollTarget.addEventListener("scroll", scheduleScrollRead, {
      passive: true,
    });
  }
  if (spacerEl) attachSpacer(spacerEl);
  if (videoEl) {
    videoEl.addEventListener("loadedmetadata", onMetadata);
    videoEl.addEventListener("seeked", onSeeked);
    if (videoEl.readyState >= 1) onMetadata();
  }

  if (debug) {
    (window as unknown as Record<string, unknown>).__scrollVideoEngine = api;
  }

  return api;
}
