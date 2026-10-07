import type { ComponentType } from "react";
import basic from "./basic";
import basicSource from "./basic.tsx?raw";
import options from "./options";

export interface TimelineRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface ExampleEntry {
  title: string;
  component: ComponentType<never>;
  source?: string;
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
