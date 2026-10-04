import type { ComponentType } from "react";
import { Almanac } from "./demos/almanac/Almanac";
import { Basics } from "./demos/basics/Basics";
import { Commute } from "./demos/commute/Commute";
import { Sunset } from "./demos/sunset/Sunset";

export interface Demo {
  slug: string;
  title: string;
  description: string;
  source: string;
  component: ComponentType;
}

export const DEMOS: Demo[] = [
  {
    slug: "sunset",
    title: "A Small Vigil",
    description:
      "A short poem over a cat watching the sunset. Lines rise in and dissolve one by one as you scroll, styled with CSS alone using each section's --progress.",
    source: "demo/src/demos/sunset/Sunset.tsx",
    component: Sunset,
  },
  {
    slug: "commute",
    title: "The Commute",
    description:
      "A daydream in six scenes, framed like a film: an iris opening, subtitles timed in seconds, and chapters you can jump between while the video scrubs along.",
    source: "demo/src/demos/commute/Commute.tsx",
    component: Commute,
  },
  {
    slug: "almanac",
    title: "Evening Almanac",
    description:
      "Live readings that follow the sunset: the time, the sun's path, daylight left and the temperature, all computed from scroll position.",
    source: "demo/src/demos/almanac/Almanac.tsx",
    component: Almanac,
  },
  {
    slug: "basics",
    title: "In a page",
    description:
      "Two scroll videos placed between ordinary content. Each pins while you scroll through it, then the page carries on.",
    source: "demo/src/demos/basics/Basics.tsx",
    component: Basics,
  },
];
