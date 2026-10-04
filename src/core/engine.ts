import type {
  EngineOptions,
  EngineAPI,
  EngineStateSnapshot,
  SectionDescriptor,
  NormalizedSection,
  EngineEvent,
  EngineEventHandler,
  EngineEventMap,
  ScrollToOptionsLite,
} from "./types";

const DEFAULT_FPS = 30;
const AUTO_VH_PER_SECOND = 40;
const DEFAULT_TAU_MS = 100;
const TIME_EPSILON_S = 0.001;
const PROGRESS_EPSILON = 0.0005;
const MAX_TICK_DT_MS = 250;
const FRAME_WAIT_TIMEOUT_MS = 300;
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

export function createEngine(options: EngineOptions): EngineAPI {
  const container = options.container;
  const stage = options.stage ?? null;
  const lengthOpt = options.length ?? "auto";
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

  let targetProgress = 0;
  let smoothedProgress = 0;
  let lastTickTime = 0;

  let tickPending = false;
  let tickRafId = 0;
  let scrollRafPending = false;

  let seekInFlight = false;
  let frameWaitActive = false;
  let frameWaitTimeoutId = 0;

  let readyEmitted = false;

  let primed = false;
  let priming = false;
  let primeSamples: number[] = [];
  let lastPrimeMediaTime = -1;
  let primeTimeoutId = 0;

  let warming = false;
  let warmupIndex = 0;
  let warmupTotal = 0;

  let destroyed = false;

  const sections = new Map<string, NormalizedSection>();
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
    container.style.height = `${scrollLengthPx() + stageHeight()}px`;
  }

  function stageHeight() {
    return stage?.offsetHeight || window.innerHeight;
  }

  function scrollLengthPx() {
    const vh = window.innerHeight / 100;
    if (lengthOpt === "auto") {
      const seconds = framesMode ? totalFrames / fps : duration;
      return Math.max(100, seconds * AUTO_VH_PER_SECOND) * vh;
    }
    if (typeof lengthOpt === "number") return Math.max(0, lengthOpt);
    const match = /^\s*([\d.]+)\s*(px|vh|svh|lvh|dvh)?\s*$/.exec(lengthOpt);
    if (!match) throw new Error(`Invalid length "${lengthOpt}": use a number of px, "px" or "vh"`);
    const value = Number(match[1]);
    return match[2] && match[2] !== "px" ? value * vh : value;
  }

  function travel() {
    return Math.max(container.offsetHeight - stageHeight(), 0);
  }

  function readScrollIntoTarget() {
    const top = container.getBoundingClientRect().top;
    const distance = travel();
    targetProgress = distance > 0 ? Math.min(Math.max(-top / distance, 0), 1) : 0;
    debugLog("scroll", { top, distance, targetProgress });
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

  function requestTick() {
    if (destroyed || tickPending) return;
    if (!framesMode && duration <= 0) return;
    tickPending = true;
    tickRafId = requestAnimationFrame(tick);
  }

  function applyEasing(p: number) {
    let eased = easingFn(p);
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
        lastTickTime = 0;
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
      lastTickTime = 0;
      return;
    }
    if (!seekInFlight) requestTick();
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

  function onSeeked() {
    if (destroyed) return;
    if (warming) {
      warmupIndex++;
      stepWarmup();
      return;
    }
    if (!hasRVFC && frameWaitActive) onFrameDone();
  }

  function prime() {
    if (primed || destroyed || !videoEl) return;
    primed = true;
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
    videoEl.pause();
    videoEl.playbackRate = 1;
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
    videoEl.currentTime = (duration * (warmupIndex + 0.5)) / warmupTotal;
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

  function updateSections() {
    const newlyActive: string[] = [];
    sections.forEach((sec) => {
      const p = state.linearProgress;
      const active = p >= sec.start && (p < sec.end || (sec.end >= 1 && p >= 1));
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
    return { id: desc.id, start, end, data: desc.data };
  }

  function onMetadata() {
    if (destroyed || !videoEl) return;
    recomputeDerived();
    readScrollIntoTarget();
    smoothedProgress = targetProgress;
    if (videoEl.readyState < 2) prime();
    else beginWarmup();
  }

  function onResize() {
    if (destroyed) return;
    recomputeDerived();
    emit("resize", { ...state });
    readScrollIntoTarget();
    requestTick();
  }

  function removeListeners() {
    if (videoEl) {
      videoEl.removeEventListener("loadedmetadata", onMetadata);
      videoEl.removeEventListener("seeked", onSeeked);
    }
    window.removeEventListener("resize", onResize);
    document.removeEventListener("scroll", scheduleScrollRead, { capture: true });
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
        videoEl.pause();
        videoEl.playbackRate = 1;
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
    notifyReady() {
      if (destroyed || readyEmitted) return;
      readyEmitted = true;
      recomputeDerived();
      readScrollIntoTarget();
      smoothedProgress = targetProgress;
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
    scrollToProgress(progress: number, opts?: ScrollToOptionsLite) {
      const p = Math.min(Math.max(progress, 0), 1);
      const top = window.scrollY + container.getBoundingClientRect().top + p * travel();
      window.scrollTo({ top, behavior: opts?.behavior ?? "smooth" });
    },
    scrollToTime(seconds: number, opts?: ScrollToOptionsLite) {
      if (duration <= 0) return;
      const want = Math.min(Math.max(seconds / duration, 0), 1);
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        if (applyEasing(mid) < want) lo = mid;
        else hi = mid;
      }
      api.scrollToProgress(hi, opts);
    },
    getSectionProgress(id: string) {
      const sec = sections.get(id);
      if (!sec) return 0;
      const t = (state.linearProgress - sec.start) / (sec.end - sec.start);
      return Math.min(Math.max(t, 0), 1);
    },
    unregisterSection(id: string) {
      sections.delete(id);
      sectionDescs.delete(id);
      updateSections();
    },
  };

  window.addEventListener("resize", onResize);
  document.addEventListener("scroll", scheduleScrollRead, { passive: true, capture: true });
  recomputeDerived();
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
