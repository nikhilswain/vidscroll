import { LOADER_HINT, createScrollVideo, loaderLabel } from "../core/controller";
import type { LoaderState, ScrollVideoController, ScrollVideoOptions } from "../core/controller";
import type { LoadedVideo } from "../core/load";
import { injectStyles } from "../core/styles";
import type { EngineStateSnapshot, ScrollToOptionsLite, SectionDescriptor } from "../core/types";

const SHADOW_CSS = `
:host { display: block; position: relative; }
:host([hidden]) { display: none; }
[data-vidscroll-stage] { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; background: #000; }
[data-vidscroll-media] { display: block; width: 100%; height: 100%; object-fit: cover; }
[data-vidscroll-media][data-fit="contain"] { object-fit: contain; }
[data-vidscroll-preview] { position: absolute; inset: 0; }
[data-vidscroll-next] { position: absolute; inset: 0; z-index: -1; }
[data-vidscroll-overlay] { position: absolute; inset: 0; pointer-events: none; }
[data-vidscroll-loader] { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); color: #fff; font-family: system-ui, sans-serif; }
[data-vidscroll-loader][data-background] { inset: auto 16px 16px auto; padding: 8px 14px; border-radius: 999px; pointer-events: none; }
[data-vidscroll-loader][hidden] { display: none; }
.loader { display: grid; justify-items: center; gap: 12px; }
.loader[data-background] { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.track { width: 220px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden; }
.loader[data-background] .track { width: 56px; }
.fill { height: 100%; background: #fff; transition: width 0.2s ease; }
.label { font-size: 13px; opacity: 0.7; }
.loader[data-background] .label { font-size: 12px; opacity: 0.8; }
.error { max-width: 520px; padding: 24px; font-size: 14px; line-height: 1.5; opacity: 0.85; }
`;

const ELEMENT_ATTRIBUTES = [
  "src",
  "length",
  "fps",
  "easing",
  "fit",
  "poster",
  "optimize",
  "full-preload",
  "smooth-scroll",
  "warmup",
  "loader",
  "debug",
];

const SECTION_ATTRIBUTES = ["id", "start", "end", "from-time", "to-time", "from-frame", "to-frame"];

const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

const numberAttr = (el: Element, name: string) => {
  const value = el.getAttribute(name);
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const flagAttr = (el: Element, name: string) => {
  const value = el.getAttribute(name);
  return value == null ? undefined : value !== "false";
};

function createDefaultLoader() {
  const root = document.createElement("div");
  root.className = "loader";
  const track = document.createElement("div");
  track.className = "track";
  const fill = document.createElement("div");
  fill.className = "fill";
  track.append(fill);
  const label = document.createElement("div");
  label.className = "label";
  root.append(track, label);
  const error = document.createElement("div");
  error.className = "error";

  return {
    root,
    error,
    update(state: LoaderState) {
      root.hidden = !!state.error;
      error.hidden = !state.error;
      if (state.error) {
        error.textContent = state.error.message;
        return;
      }
      root.toggleAttribute("data-background", state.background);
      root.title = state.background ? LOADER_HINT : "";
      fill.style.width = `${Math.round(state.progress * 100)}%`;
      label.textContent = loaderLabel(state);
    },
  };
}

let sectionCount = 0;

export class VidScrollSectionElement extends Base {
  static observedAttributes = SECTION_ATTRIBUTES;
  #host: VidScrollElement | null = null;
  #autoId = `vid-scroll-section-${++sectionCount}`;
  registeredId: string | null = null;

  get sectionId() {
    return this.id || this.#autoId;
  }

  get range(): SectionDescriptor {
    return {
      id: this.sectionId,
      start: numberAttr(this, "start"),
      end: numberAttr(this, "end"),
      fromTime: numberAttr(this, "from-time"),
      toTime: numberAttr(this, "to-time"),
      fromFrame: numberAttr(this, "from-frame"),
      toFrame: numberAttr(this, "to-frame"),
    };
  }

  connectedCallback() {
    this.setAttribute("data-vidscroll-section", this.sectionId);
    const host = this.closest("vid-scroll");
    this.#host = host instanceof VidScrollElement ? host : null;
    this.#host?.attachSection(this);
  }

  disconnectedCallback() {
    this.#host?.detachSection(this);
    this.#host = null;
  }

  attributeChangedCallback() {
    if (!this.#host) return;
    this.setAttribute("data-vidscroll-section", this.sectionId);
    this.#host.detachSection(this);
    this.#host.attachSection(this);
  }
}

export class VidScrollElement extends Base {
  static observedAttributes = ELEMENT_ATTRIBUTES;
  #controller: ScrollVideoController | null = null;
  #stage: HTMLElement | null = null;
  #loaderBox: HTMLElement | null = null;
  #defaultLoader: ReturnType<typeof createDefaultLoader> | null = null;
  #sections = new Set<VidScrollSectionElement>();
  #sectionProgress = new Map<VidScrollSectionElement, number>();
  #options: Partial<ScrollVideoOptions> = {};
  #scheduled = false;

  get api(): ScrollVideoController | null {
    return this.#controller;
  }

  get options(): Partial<ScrollVideoOptions> {
    return this.#options;
  }

  set options(value: Partial<ScrollVideoOptions> | null | undefined) {
    this.#options = value ?? {};
    this.#schedule();
  }

  scrollToTime(seconds: number, opts?: ScrollToOptionsLite) {
    this.#controller?.scrollToTime(seconds, opts);
  }

  scrollToProgress(progress: number, opts?: ScrollToOptionsLite) {
    this.#controller?.scrollToProgress(progress, opts);
  }

  connectedCallback() {
    injectStyles();
    this.#render();
    this.#sync();
  }

  disconnectedCallback() {
    this.#stop();
  }

  attributeChangedCallback() {
    this.#schedule();
  }

  attachSection(section: VidScrollSectionElement) {
    this.#sections.add(section);
    const controller = this.#controller;
    if (!controller) return;
    const range = section.range;
    try {
      controller.addSection(range);
    } catch (err) {
      console.error(err);
      return;
    }
    section.registeredId = range.id;
    section.toggleAttribute("data-active", controller.getState().activeSections.includes(range.id));
    this.#applySectionProgress(section);
  }

  detachSection(section: VidScrollSectionElement) {
    this.#sections.delete(section);
    this.#sectionProgress.delete(section);
    if (section.registeredId != null) this.#controller?.removeSection(section.registeredId);
    section.registeredId = null;
    section.removeAttribute("data-active");
  }

  #schedule() {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#sync();
    });
  }

  #readOptions(): ScrollVideoOptions {
    const extra = this.#options;
    const optimize = this.getAttribute("optimize");
    const warmup = this.getAttribute("warmup");
    const poster = this.getAttribute("poster");
    const fit = this.getAttribute("fit");
    return {
      src: this.getAttribute("src") ?? "",
      length: this.getAttribute("length") ?? undefined,
      fps: numberAttr(this, "fps"),
      easing: (this.getAttribute("easing") ?? undefined) as ScrollVideoOptions["easing"],
      fit: fit === "contain" || fit === "cover" ? fit : undefined,
      poster: poster == null ? undefined : poster === "" || poster === "none" ? false : poster,
      optimize: optimize == null ? undefined : optimize === "false" ? false : optimize === "wait" ? { wait: true } : true,
      fullPreload: flagAttr(this, "full-preload"),
      smoothScroll: flagAttr(this, "smooth-scroll"),
      warmup:
        warmup == null ? undefined : warmup === "false" ? false : numberAttr(this, "warmup") ?? true,
      debug: flagAttr(this, "debug"),
      ...extra,
      onLoad: (info: Pick<LoadedVideo, "source" | "probe">) => {
        extra.onLoad?.(info);
        this.#dispatch("vidscroll-load", info);
      },
      onError: (error: Error) => {
        extra.onError?.(error);
        this.#dispatch("vidscroll-error", error);
      },
    };
  }

  #sync() {
    if (!this.isConnected || !this.#stage) return;
    const options = this.#readOptions();
    if (!options.src) return this.#stop();
    if (this.#controller) {
      this.#controller.update(options);
      this.#showLoader(this.#controller.getLoader());
      return;
    }
    const controller = createScrollVideo({ container: this, stage: this.#stage }, options);
    this.#controller = controller;
    controller.on("loader", (state) => {
      this.#showLoader(state);
      this.#dispatch("vidscroll-loader", state);
    });
    controller.on("ready", (state) => this.#dispatch("vidscroll-ready", state));
    controller.on("sectionEnter", ({ id }) => this.#setActive(id, true));
    controller.on("sectionExit", ({ id }) => this.#setActive(id, false));
    controller.on("update", () => this.#sections.forEach((s) => this.#applySectionProgress(s)));
    for (const section of [...this.#sections]) this.attachSection(section);
    this.#showLoader(controller.getLoader());
  }

  #stop() {
    this.#controller?.destroy();
    this.#controller = null;
    for (const section of this.#sections) section.registeredId = null;
    this.#sectionProgress.clear();
    this.#showLoader(null);
  }

  #render() {
    if (this.#stage) return;
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;
    const stage = document.createElement("div");
    stage.setAttribute("data-vidscroll-stage", "");
    stage.setAttribute("part", "stage");
    const overlay = document.createElement("div");
    overlay.setAttribute("data-vidscroll-overlay", "");
    overlay.setAttribute("part", "overlay");
    overlay.append(document.createElement("slot"));
    const loaderBox = document.createElement("div");
    loaderBox.setAttribute("data-vidscroll-loader", "");
    loaderBox.setAttribute("part", "loader");
    loaderBox.hidden = true;
    const loaderSlot = document.createElement("slot");
    loaderSlot.name = "loader";
    const defaultLoader = createDefaultLoader();
    loaderSlot.append(defaultLoader.root, defaultLoader.error);
    loaderBox.append(loaderSlot);
    stage.append(overlay, loaderBox);
    root.replaceChildren(style, stage);
    this.#stage = stage;
    this.#loaderBox = loaderBox;
    this.#defaultLoader = defaultLoader;
  }

  #showLoader(state: LoaderState | null) {
    const box = this.#loaderBox;
    if (!box) return;
    this.toggleAttribute("data-background", !!state?.background);
    if (state) {
      this.setAttribute("data-phase", state.phase);
      this.style.setProperty("--loader-progress", state.progress.toFixed(2));
    } else {
      this.removeAttribute("data-phase");
      this.style.removeProperty("--loader-progress");
    }
    const mode = this.getAttribute("loader");
    const custom = this.querySelector(':scope > [slot="loader"]') != null;
    const hidden = !state || mode === "none" || mode === "false" || (custom && state.background);
    box.hidden = hidden;
    if (hidden || !state) return;
    box.setAttribute("data-phase", state.phase);
    box.toggleAttribute("data-background", state.background);
    this.#defaultLoader?.update(state);
  }

  #setActive(id: string, active: boolean) {
    for (const section of this.#sections) {
      if (section.registeredId !== id) continue;
      section.toggleAttribute("data-active", active);
      this.#dispatch(active ? "vidscroll-enter" : "vidscroll-exit", { id }, section);
    }
  }

  #applySectionProgress(section: VidScrollSectionElement) {
    if (!this.#controller || section.registeredId == null) return;
    const p = this.#controller.getSectionProgress(section.registeredId);
    const last = this.#sectionProgress.get(section);
    if (last != null && Math.abs(p - last) < 0.0001) return;
    this.#sectionProgress.set(section, p);
    section.style.setProperty("--progress", p.toFixed(4));
  }

  #dispatch(type: string, detail: unknown, target: HTMLElement = this) {
    target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }
}

export interface VidScrollEventMap {
  "vidscroll-load": CustomEvent<Pick<LoadedVideo, "source" | "probe">>;
  "vidscroll-error": CustomEvent<Error>;
  "vidscroll-loader": CustomEvent<LoaderState | null>;
  "vidscroll-ready": CustomEvent<EngineStateSnapshot>;
  "vidscroll-enter": CustomEvent<{ id: string }>;
  "vidscroll-exit": CustomEvent<{ id: string }>;
}

declare global {
  interface HTMLElementTagNameMap {
    "vid-scroll": VidScrollElement;
    "vid-scroll-section": VidScrollSectionElement;
  }
}

if (typeof customElements !== "undefined") {
  if (!customElements.get("vid-scroll")) customElements.define("vid-scroll", VidScrollElement);
  if (!customElements.get("vid-scroll-section")) customElements.define("vid-scroll-section", VidScrollSectionElement);
}

export type { LoaderState, ScrollVideoController, ScrollVideoOptions } from "../core/controller";
