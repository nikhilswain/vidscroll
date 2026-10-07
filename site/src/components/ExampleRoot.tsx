import type { ComponentType } from "react";
import { EXAMPLES } from "../examples";

const EASINGS = ["none", "inQuad", "outQuad", "inOutQuad", "inCubic", "outCubic", "inOutCubic", "inOutSine"];

function optionsFromQuery() {
  const q = new URLSearchParams(location.search);
  const easing = q.get("easing") ?? "none";
  const fit = q.get("fit") === "contain" ? "contain" : "cover";
  return {
    easing: EASINGS.includes(easing) ? easing : "none",
    length: q.get("length") ?? "400vh",
    fit,
    smoothScroll: q.get("smoothScroll") === "true",
  };
}

export default function ExampleRoot({ name }: { name: string }) {
  const Component = EXAMPLES[name].component as ComponentType<Record<string, unknown>>;
  return <Component {...(name === "options" ? optionsFromQuery() : {})} />;
}
