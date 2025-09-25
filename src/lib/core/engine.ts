import type {
  EngineOptions,
  EngineAPI,
  EngineStateSnapshot,
  SectionDescriptor,
  NormalizedSection,
  InternalEngineAPI,
  EngineEvent,
  EngineEventHandler,
  EngineEventMap,
} from "./types";

const DEFAULT_FPS = 30;
const DEFAULT_PPF = 12;
const DEFAULT_BUFFER = 2;

type ListenerSets = { [K in EngineEvent]: Set<EngineEventHandler<K>> };

export function createEngine(options: EngineOptions): EngineAPI {
  const fps = options.fps ?? DEFAULT_FPS;
  const pixelsPerFrame = options.pixelsPerFrame ?? DEFAULT_PPF;
  const bufferFrames = options.bufferFrames ?? DEFAULT_BUFFER;
  const scrollTarget: Window | HTMLElement = options.scrollTarget || window;
  const minScrollHeight = options.minScrollHeight ?? 1200;
  const easingFn = options.easing || ((t: number) => t);

  const videoEl = options.video!; // enforced below
  if (!options.video)
    throw new Error("Engine requires a video element (pass options.video)");

  let totalFrames = 0;
  let duration = 0;
  let spacerEl: HTMLDivElement | null = null; // Provided externally in React layer normally
  let lastFrame = -1;
  let rafPending = false;
  let destroyed = false;

  const sections = new Map<string, NormalizedSection>();
  const listeners: ListenerSets = {
    ready: new Set(),
    update: new Set(),
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
    const set = listeners[evt] as Set<EngineEventHandler<K>>;
    set.forEach((cb) => cb(payload));
  }

  function recomputeDerived() {
    duration = videoEl.duration || 0;
    totalFrames = Math.max(1, Math.round(duration * fps));
    state.totalFrames = totalFrames;
    state.duration = duration;
    // Adjust spacer height if available
    if (spacerEl) {
      const scrollLength = Math.max(
        (totalFrames + bufferFrames) * pixelsPerFrame + window.innerHeight,
        minScrollHeight
      );
      spacerEl.style.height = scrollLength + "px";
    }
  }

  function updateFromScroll() {
    if (destroyed) return;
    rafPending = false;
    const maxScrollable =
      (spacerEl?.scrollHeight || document.body.scrollHeight) -
      window.innerHeight;
    const y =
      scrollTarget === window
        ? window.scrollY
        : (scrollTarget as HTMLElement).scrollTop;
    const linear =
      maxScrollable > 0 ? Math.min(Math.max(y / maxScrollable, 0), 1) : 0;
    state.linearProgress = linear;

    if (duration > 0) {
      let eased = easingFn(linear);
      // Protect last ~1% from over-compression (avoid perceptual snap)
      if (eased > 0.99) {
        const tailPortion = (eased - 0.99) / 0.01; // 0..1 within last percent
        // Blend back toward linear to ensure smooth landing on final frames
        eased = 0.99 + tailPortion * (linear - 0.99);
      }
      let frame = Math.floor(eased * (totalFrames - 1));
      if (linear >= 0.999) frame = totalFrames - 1; // guarantee landing
      frame = Math.min(totalFrames - 1, Math.max(0, frame));
      state.frameIndex = frame;
      if (frame !== lastFrame) {
        lastFrame = frame;
        const targetTime = (frame / (totalFrames - 1)) * duration;
        videoEl.currentTime = targetTime;
        updateSections();
        emit("update", { ...state });
      }
    }
  }

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

  function schedule() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(updateFromScroll);
    }
  }

  function onMetadata() {
    recomputeDerived();
    emit("ready", { ...state });
    schedule();
  }

  function onResize() {
    recomputeDerived();
    emit("resize", { ...state });
    schedule();
  }

  function addSpacer(el: HTMLDivElement) {
    spacerEl = el;
    recomputeDerived();
  }

  // Public API
  const api: InternalEngineAPI = {
    destroy() {
      destroyed = true;
      videoEl.removeEventListener("loadedmetadata", onMetadata);
      window.removeEventListener("resize", onResize);
    },
    getState() {
      return { ...state };
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
      const norm = normalizeSection(desc);
      sections.set(desc.id, norm);
      updateSections();
    },
    unregisterSection(id: string) {
      sections.delete(id);
      updateSections();
    },
  };

  function normalizeSection(desc: SectionDescriptor): NormalizedSection {
    // Priority: explicit start/end > times > frames
    let start: number | undefined = desc.start;
    let end: number | undefined = desc.end;
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
    return {
      id: desc.id,
      start,
      end,
      mode: desc.mode || "normal",
      data: desc.data,
    };
  }

  // Listeners
  videoEl.addEventListener("loadedmetadata", onMetadata);
  window.addEventListener("resize", onResize);
  if (videoEl.readyState >= 1) onMetadata();

  if (scrollTarget instanceof Window) {
    window.addEventListener("scroll", schedule, { passive: true });
  } else {
    scrollTarget.addEventListener("scroll", schedule, { passive: true });
  }

  // Expose internal method for React layer to attach spacer
  api._attachSpacer = addSpacer;

  return api;
}
