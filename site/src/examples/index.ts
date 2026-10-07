import type { ComponentType } from "react";
import basic from "./basic";
import basicSource from "./basic.tsx?raw";
import options from "./options";
import elementSource from "./element.html?raw";
import elementApiSource from "./element-api.html?raw";
import progress from "./progress";
import progressSource from "./progress.tsx?raw";
import hooks from "./hooks";
import hooksSource from "./hooks.tsx?raw";
import captions from "./captions";
import captionsSource from "./captions.tsx?raw";
import scrollCss from "./scroll-css";
import scrollCssSource from "./scroll-css.tsx?raw";
import chapters from "./chapters";
import chaptersSource from "./chapters.tsx?raw";
import liveValues from "./live-values";
import liveValuesSource from "./live-values.tsx?raw";
import cdn from "./cdn";
import cdnSource from "./cdn.tsx?raw";
import frames from "./frames";
import framesSource from "./frames.tsx?raw";

export interface TimelineRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface ExampleEntry {
  title: string;
  component?: ComponentType<never>;
  source?: string;
  lang?: "tsx" | "html";
  frames?: number;
  timeline: TimelineRange[];
}

export const EXAMPLES: Record<string, ExampleEntry> = {
  basic: {
    title: "A scroll video with two sections",
    component: basic,
    source: basicSource,
    timeline: [
      { id: "doors", label: "Doors close", start: 0, end: 0.3 },
      { id: "water", label: "Open water", start: 0.55, end: 0.9 },
    ],
  },
  progress: {
    title: "A section driven by --progress",
    component: progress,
    source: progressSource,
    timeline: [{ id: "caption", label: "caption (start 0.1, end 0.9)", start: 0.1, end: 0.9 }],
  },
  hooks: {
    title: "Hooks: timecode, progress bar and chapters",
    component: hooks,
    source: hooksSource,
    timeline: [],
  },
  captions: {
    title: "Captions and staggered lines",
    component: captions,
    source: captionsSource,
    timeline: [
      { id: "doors", label: "1 s to 6 s", start: 1 / 29.16, end: 6 / 29.16 },
      { id: "stanza", label: "stanza, 0.45 to 0.85", start: 0.45, end: 0.85 },
    ],
  },
  "scroll-css": {
    title: "Scroll-driven CSS",
    component: scrollCss,
    source: scrollCssSource,
    timeline: [{ id: "iris", label: "iris, 0 to 0.2", start: 0, end: 0.2 }],
  },
  chapters: {
    title: "Chapter navigation",
    component: chapters,
    source: chaptersSource,
    timeline: [],
  },
  "live-values": {
    title: "Live values",
    component: liveValues,
    source: liveValuesSource,
    timeline: [],
  },
  cdn: {
    title: "A video from a CDN",
    component: cdn,
    source: cdnSource,
    timeline: [],
  },
  frames: {
    title: "An image sequence with ScrollFrames",
    component: frames,
    source: framesSource,
    frames: 87,
    timeline: [
      { id: "stills", label: "start 0, end 0.4", start: 0, end: 0.4 },
      { id: "water", label: "frames 50 to 75", start: 50 / 87, end: 75 / 87 },
    ],
  },
  element: {
    title: "The <vid-scroll> element",
    source: elementSource,
    lang: "html",
    timeline: [
      { id: "doors", label: "Doors close", start: 0, end: 0.3 },
      { id: "water", label: "Open water", start: 0.55, end: 0.9 },
    ],
  },
  "element-api": {
    title: "The <vid-scroll> element from JavaScript",
    source: elementApiSource,
    lang: "html",
    timeline: [],
  },
  options: {
    title: "ScrollVideo options",
    component: options as ComponentType<never>,
    timeline: [],
  },
};

export const displaySource = (source: string) =>
  source
    .replace(/^import \{ asset \} from "\.\/asset";\n/m, "")
    .replace(/\{asset\("([^"]+)"\)\}/g, '"/$1"');
