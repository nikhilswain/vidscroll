import type { ComponentType } from "react";
import { DEMO_META } from "./demo-meta";
import type { DemoMeta } from "./demo-meta";
import { Almanac } from "./demos/almanac/Almanac";
import { Basics } from "./demos/basics/Basics";
import { Cdn } from "./demos/cdn/Cdn";
import { Commute } from "./demos/commute/Commute";
import { Sunset } from "./demos/sunset/Sunset";

export interface Demo extends DemoMeta {
  component?: ComponentType;
}

const COMPONENTS: Record<string, ComponentType> = {
  sunset: Sunset,
  commute: Commute,
  almanac: Almanac,
  cdn: Cdn,
  basics: Basics,
};

export const DEMOS: Demo[] = DEMO_META.map((meta) => ({ ...meta, component: COMPONENTS[meta.slug] }));
