import { useEffect, useRef, useState } from "react";
import type { EngineAPI, EngineStateSnapshot } from "../core/types";
import { useScrollVideo } from "./context";

export function useScrollVideoUpdate(callback: (state: EngineStateSnapshot) => void) {
  const { api } = useScrollVideo();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    if (!api) return;
    const onUpdate = (state: EngineStateSnapshot) => callbackRef.current(state);
    onUpdate(api.getState());
    api.on("update", onUpdate);
    return () => api.off("update", onUpdate);
  }, [api]);
}

export interface ScrollVideoState {
  ready: boolean;
  progress: number;
  time: number;
  frame: number;
  activeSections: string[];
}

const IDLE: ScrollVideoState = { ready: false, progress: 0, time: 0, frame: 0, activeSections: [] };

function snapshot(api: EngineAPI | null, state?: EngineStateSnapshot): ScrollVideoState {
  if (!api) return IDLE;
  const s = state ?? api.getState();
  return {
    ready: api.isReady(),
    progress: s.linearProgress,
    time: s.time,
    frame: s.frameIndex,
    activeSections: s.activeSections,
  };
}

const sameState = (a: ScrollVideoState, b: ScrollVideoState) =>
  a.ready === b.ready &&
  a.progress === b.progress &&
  a.time === b.time &&
  a.frame === b.frame &&
  a.activeSections.join() === b.activeSections.join();

export function useScrollVideoState(): ScrollVideoState {
  const { api } = useScrollVideo();
  const [state, setState] = useState<ScrollVideoState>(IDLE);
  useEffect(() => {
    const sync = (s?: EngineStateSnapshot) => {
      const next = snapshot(api, s);
      setState((prev) => (sameState(prev, next) ? prev : next));
    };
    sync();
    if (!api) return;
    const onReady = () => sync();
    api.on("update", sync);
    api.on("ready", onReady);
    return () => {
      api.off("update", sync);
      api.off("ready", onReady);
    };
  }, [api]);
  return state;
}

export function useVideoProgressVariable(api: EngineAPI | null, target: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = target.current;
    if (!api || !el) return;
    let last = -1;
    const apply = (s: EngineStateSnapshot) => {
      if (Math.abs(s.linearProgress - last) < 0.0001) return;
      last = s.linearProgress;
      el.style.setProperty("--video-progress", s.linearProgress.toFixed(4));
    };
    apply(api.getState());
    api.on("update", apply);
    return () => api.off("update", apply);
  }, [api, target]);
}
