import { createContext, useContext } from "react";
import type { EngineAPI } from "../core/types";

export interface ScrollVideoContextValue {
  api: EngineAPI | null;
}

export const ScrollVideoContext = createContext<ScrollVideoContextValue>({ api: null });

export function useScrollVideo() {
  return useContext(ScrollVideoContext);
}
