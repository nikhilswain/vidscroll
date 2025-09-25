import { createContext, useContext } from "react";
import type { EngineAPI, EngineStateSnapshot } from "../core/types";

export interface ScrollVideoContextValue {
  api: EngineAPI | null;
  state: EngineStateSnapshot | null;
  sectionDisplayMode: "layered" | "exclusive" | "crossfade";
  crossfadeDurationMs: number;
}

export const ScrollVideoContext = createContext<ScrollVideoContextValue>({
  api: null,
  state: null,
  sectionDisplayMode: "layered",
  crossfadeDurationMs: 400,
});

export function useScrollVideo() {
  return useContext(ScrollVideoContext);
}
