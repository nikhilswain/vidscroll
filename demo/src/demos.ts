import type { ComponentType } from "react";
import { SPRING_CREDIT, TRAIN_CREDIT } from "./credits";
import type { Credit } from "./credits";
import { Almanac } from "./demos/almanac/Almanac";
import { Basics } from "./demos/basics/Basics";
import { Cdn } from "./demos/cdn/Cdn";
import { Commute } from "./demos/commute/Commute";
import { Sunset } from "./demos/sunset/Sunset";

export interface Demo {
  slug: string;
  title: string;
  description: string;
  source: string;
  poster: string;
  credit?: Credit;
  component?: ComponentType;
  href?: string;
}

export const DEMOS: Demo[] = [
  {
    slug: "sunset",
    title: "A Small Vigil",
    description:
      "A short poem over a cat watching the sunset. Lines rise in and dissolve one by one as you scroll, styled with nothing but CSS.",
    source: "demo/src/demos/sunset/Sunset.tsx",
    poster: "/posters/sunset.webp",
    component: Sunset,
  },
  {
    slug: "commute",
    title: "The Commute",
    description:
      "A daydream in six scenes, framed like a film: an iris opening, subtitles timed in seconds, and chapters you can jump between while the video scrubs along.",
    source: "demo/src/demos/commute/Commute.tsx",
    poster: "/posters/commute.webp",
    credit: TRAIN_CREDIT,
    component: Commute,
  },
  {
    slug: "almanac",
    title: "Evening Almanac",
    description:
      "Live readings that follow the sunset: the time, the sun's path, daylight left and the temperature, all computed from scroll position.",
    source: "demo/src/demos/almanac/Almanac.tsx",
    poster: "/posters/almanac.webp",
    component: Almanac,
  },
  {
    slug: "cdn",
    title: "From a CDN",
    description:
      "Two clips loaded from other websites, one with CORS and one without, each showing how the library ended up serving it.",
    source: "demo/src/demos/cdn/Cdn.tsx",
    poster: "/posters/cdn.webp",
    credit: SPRING_CREDIT,
    component: Cdn,
  },
  {
    slug: "basics",
    title: "In a page",
    description:
      "Two scroll videos placed between ordinary content. Each pins while you scroll through it, then the page carries on.",
    source: "demo/src/demos/basics/Basics.tsx",
    poster: "/posters/basics.webp",
    credit: TRAIN_CREDIT,
    component: Basics,
  },
  {
    slug: "element",
    title: "Without React",
    description:
      "A plain HTML page using the experimental <vid-scroll> custom element: sections as child elements, chapter buttons, no framework at all.",
    source: "demo/element.html",
    poster: "/posters/commute.webp",
    credit: TRAIN_CREDIT,
    href: "/element.html",
  },
];
