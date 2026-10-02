import { createContext, useContext } from "react";
import type { EngineAPI } from "../core/types";

export interface ScrollVideoContextValue {
  api: EngineAPI | null;
  sectionDisplayMode: "layered" | "exclusive" | "crossfade";
  crossfadeDurationMs: number;
}

export const ScrollVideoContext = createContext<ScrollVideoContextValue>({
  api: null,
  sectionDisplayMode: "layered",
  crossfadeDurationMs: 400,
});

export function useScrollVideo() {
  return useContext(ScrollVideoContext);
}
