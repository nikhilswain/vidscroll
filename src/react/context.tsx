import { createContext, useContext } from "react";
import type { EngineAPI, ScrollVideoApi } from "../core/types";

export interface ScrollVideoContextValue {
  api: EngineAPI | null;
}

export const ScrollVideoContext = createContext<ScrollVideoContextValue>({ api: null });

export function useEngine() {
  return useContext(ScrollVideoContext).api;
}

export function useScrollVideo(): { api: ScrollVideoApi | null } {
  return { api: useEngine() };
}
