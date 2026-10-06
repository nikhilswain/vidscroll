import { createContext, useContext } from "react";
import type { ScrollVideoApi } from "../core/types";

export interface ScrollVideoContextValue {
  api: ScrollVideoApi | null;
}

export const ScrollVideoContext = createContext<ScrollVideoContextValue>({ api: null });

export function useEngine() {
  return useContext(ScrollVideoContext).api;
}

export function useScrollVideo(): { api: ScrollVideoApi | null } {
  return { api: useEngine() };
}
