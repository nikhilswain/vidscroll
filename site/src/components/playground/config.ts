import { easing } from "vidscroll";
import type { EasingName } from "vidscroll";

export type VideoChoice = "train" | "cat" | "file";
export type OptimizeChoice = "on" | "wait" | "off";
export type Unit = "scroll" | "time";

export interface SectionConfig {
  id: string;
  text: string;
  unit: Unit;
  from: number;
  to: number;
}

export interface Config {
  video: VideoChoice;
  length: number;
  easing: EasingName;
  fit: "cover" | "contain";
  smoothScroll: boolean;
  smoothing: number | null;
  optimize: OptimizeChoice;
  sections: SectionConfig[];
}

export interface FrameConfig extends Omit<Config, "video"> {
  src: string;
}

export const EASING_NAMES = Object.keys(easing) as EasingName[];

export const VIDEOS: Record<Exclude<VideoChoice, "file">, { label: string; file: string; note: string }> = {
  train: { label: "Train", file: "train.mp4", note: "Prepared with the CLI: smooth straight away." },
  cat: { label: "Cat", file: "catAnime.mp4", note: "Raw export: re-encoded in your browser on the first visit." },
};

export const DEFAULT_SMOOTHING = (smoothScroll: boolean) => (smoothScroll ? 35 : 100);

let counter = 0;
export const sectionId = () => `section-${Date.now().toString(36)}-${counter++}`;

const section = (text: string, unit: Unit, from: number, to: number): SectionConfig => ({
  id: sectionId(),
  text,
  unit,
  from,
  to,
});

export const PRESETS: { name: string; description: string; make: () => Config }[] = [
  {
    name: "Hero",
    description: "Three titles over a prepared video",
    make: () => ({
      video: "train",
      length: 400,
      easing: "inOutSine",
      fit: "cover",
      smoothScroll: true,
      smoothing: null,
      optimize: "on",
      sections: [section("Doors close", "scroll", 0, 0.3), section("Another morning", "scroll", 0.35, 0.65), section("Away", "scroll", 0.7, 1)],
    }),
  },
  {
    name: "Captions",
    description: "Lines timed to seconds of footage",
    make: () => ({
      video: "train",
      length: 600,
      easing: "none",
      fit: "contain",
      smoothScroll: false,
      smoothing: null,
      optimize: "on",
      sections: [section("She steps on board.", "time", 1, 6), section("The city slides past.", "time", 9, 15), section("Somewhere else.", "time", 19, 26)],
    }),
  },
  {
    name: "Raw video",
    description: "Watch a raw export get optimized",
    make: () => ({
      video: "cat",
      length: 800,
      easing: "none",
      fit: "cover",
      smoothScroll: true,
      smoothing: null,
      optimize: "on",
      sections: [section("Scroll while it optimizes", "scroll", 0, 0.5)],
    }),
  },
  {
    name: "Blank",
    description: "Just the video",
    make: () => ({
      video: "train",
      length: 400,
      easing: "none",
      fit: "cover",
      smoothScroll: false,
      smoothing: null,
      optimize: "on",
      sections: [],
    }),
  },
];

export const DEFAULT_CONFIG = PRESETS[0].make;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function encodeConfig(config: Config): string {
  const data = {
    v: config.video === "file" ? "train" : config.video,
    l: config.length,
    e: config.easing,
    f: config.fit,
    s: config.smoothScroll ? 1 : 0,
    t: config.smoothing,
    o: config.optimize,
    x: config.sections.map((s) => [s.text, s.unit === "time" ? 1 : 0, s.from, s.to]),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export function decodeConfig(hash: string): Config | null {
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(hash))));
    return {
      video: d.v === "cat" ? "cat" : "train",
      length: clamp(Number(d.l) || 400, 150, 2000),
      easing: EASING_NAMES.includes(d.e) ? d.e : "none",
      fit: d.f === "contain" ? "contain" : "cover",
      smoothScroll: d.s === 1,
      smoothing: typeof d.t === "number" ? clamp(d.t, 10, 400) : null,
      optimize: d.o === "wait" || d.o === "off" ? d.o : "on",
      sections: Array.isArray(d.x)
        ? d.x.slice(0, 12).map((s: unknown[]) => ({
            id: sectionId(),
            text: String(s[0] ?? "").slice(0, 80),
            unit: s[1] === 1 ? "time" : "scroll",
            from: Number(s[2]) || 0,
            to: Number(s[3]) || 0,
          }))
        : [],
    };
  } catch {
    return null;
  }
}

const round = (n: number, digits = 2) => String(Math.round(n * 10 ** digits) / 10 ** digits);

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeJsx = (text: string) => escapeText(text).replace(/[{}]/g, (c) => `{"${c}"}`);

export function reactCode(config: Config, src: string): string {
  const props = [`src="${src}"`, `length="${config.length}vh"`];
  if (config.easing !== "none") props.push(`easing="${config.easing}"`);
  if (config.fit !== "cover") props.push(`fit="${config.fit}"`);
  if (config.smoothScroll) props.push("smoothScroll");
  if (config.smoothing != null) props.push(`smoothingTauMs={${config.smoothing}}`);
  if (config.optimize === "wait") props.push("optimize={{ wait: true }}");
  if (config.optimize === "off") props.push("optimize={false}");
  const open = props.join(" ").length > 60 ? `<ScrollVideo\n      ${props.join("\n      ")}\n    >` : `<ScrollVideo ${props.join(" ")}>`;
  const imports = config.sections.length ? "ScrollVideo, Section" : "ScrollVideo";
  const sections = config.sections.map((s) => {
    const range = s.unit === "time" ? `fromTime={${round(s.from, 1)}} toTime={${round(s.to, 1)}}` : `start={${round(s.from)}} end={${round(s.to)}}`;
    return `      <Section ${range}>\n        <h2>${escapeJsx(s.text)}</h2>\n      </Section>`;
  });
  const body = sections.length ? `${open}\n${sections.join("\n")}\n    </ScrollVideo>` : open.replace(/>$/, " />");
  return `import { ${imports} } from "vidscroll";\n\nexport function Hero() {\n  return (\n    ${body}\n  );\n}\n`;
}

export function htmlCode(config: Config, src: string, version: string): string {
  const attrs = [`src="${src}"`, `length="${config.length}vh"`];
  if (config.easing !== "none") attrs.push(`easing="${config.easing}"`);
  if (config.fit !== "cover") attrs.push(`fit="${config.fit}"`);
  if (config.smoothScroll) attrs.push("smooth-scroll");
  if (config.optimize === "wait") attrs.push('optimize="wait"');
  if (config.optimize === "off") attrs.push('optimize="false"');
  const sections = config.sections.map((s) => {
    const range = s.unit === "time" ? `from-time="${round(s.from, 1)}" to-time="${round(s.to, 1)}"` : `start="${round(s.from)}" end="${round(s.to)}"`;
    return `  <vid-scroll-section ${range}>\n    <h2>${escapeText(s.text)}</h2>\n  </vid-scroll-section>`;
  });
  const script = `<script\n  type="module"\n  src="https://cdn.jsdelivr.net/npm/vidscroll@${version}/dist/cdn/vidscroll-element.js"\n></script>`;
  const open = attrs.join(" ").length > 50 ? `<vid-scroll\n  ${attrs.join("\n  ")}\n>` : `<vid-scroll ${attrs.join(" ")}>`;
  const element = `${open}\n${sections.join("\n")}${sections.length ? "\n" : ""}</vid-scroll>`;
  const smoothing =
    config.smoothing != null
      ? `\n\n<script type="module">\n  document.querySelector("vid-scroll").options = { smoothingTauMs: ${config.smoothing} };\n</script>`
      : "";
  return `${script}\n\n${element}${smoothing}\n`;
}
