import { useEffect, useRef, useState } from "react";
import { ScrollVideo, Section, useScrollVideo, useScrollVideoUpdate } from "vidscroll";
import type { FrameConfig } from "./config";

export type FrameMessage =
  | { type: "pg-config"; config: FrameConfig }
  | { type: "pg-seek"; progress: number }
  | { type: "pg-auto"; on: boolean };

export interface FrameState {
  type: "pg-state";
  progress: number;
  time: number;
  frame: number;
  duration: number;
  active: string[];
  ready: boolean;
  auto: boolean;
}

const post = (message: object) => parent.postMessage(message, location.origin);

function Reporter({ auto, setAuto }: { auto: boolean; setAuto: (on: boolean) => void }) {
  const { api } = useScrollVideo();
  const last = useRef("");
  const autoRef = useRef(auto);
  autoRef.current = auto;

  useScrollVideoUpdate((snapshot) => {
    const state: FrameState = {
      type: "pg-state",
      progress: snapshot.linearProgress,
      time: snapshot.time,
      frame: snapshot.frameIndex,
      duration: snapshot.duration,
      active: snapshot.activeSections,
      ready: api?.isReady() ?? false,
      auto: autoRef.current,
    };
    const key = JSON.stringify(state);
    if (key !== last.current) {
      last.current = key;
      post(state);
    }
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent<FrameMessage>) => {
      if (event.origin !== location.origin || event.data?.type !== "pg-seek") return;
      api?.scrollToProgress(event.data.progress, { behavior: "instant" });
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [api]);

  useEffect(() => {
    if (!auto) return;
    const block = document.querySelector<HTMLElement>("[data-vidscroll]");
    if (!block) return;
    const max = () => Math.max(block.offsetHeight - innerHeight, 0);
    if (scrollY >= max() - 2) scrollTo({ top: 0, behavior: "instant" });
    let position = scrollY;
    let previous = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(now - previous, 50);
      previous = now;
      position = Math.min(position + (max() / 12000) * dt, max());
      scrollTo({ top: position, behavior: "instant" });
      if (position >= max()) {
        setAuto(false);
        return;
      }
      frame = requestAnimationFrame(step);
    });
    const stop = () => setAuto(false);
    addEventListener("wheel", stop, { passive: true });
    addEventListener("touchstart", stop, { passive: true });
    addEventListener("keydown", stop);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("wheel", stop);
      removeEventListener("touchstart", stop);
      removeEventListener("keydown", stop);
    };
  }, [auto, setAuto]);

  return null;
}

export function PlaygroundFrame() {
  const [config, setConfig] = useState<FrameConfig | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<FrameMessage>) => {
      if (event.origin !== location.origin) return;
      if (event.data?.type === "pg-config") setConfig(event.data.config);
      if (event.data?.type === "pg-auto") setAuto(event.data.on);
    };
    addEventListener("message", onMessage);
    post({ type: "pg-ready" });
    return () => removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!auto) post({ type: "pg-auto-off" });
  }, [auto]);

  if (!config) return null;

  return (
    <>
      <ScrollVideo
        key={`${config.src}|${config.fit}|${config.optimize}`}
        src={config.src}
        length={`${config.length}vh`}
        easing={config.easing}
        fit={config.fit}
        smoothScroll={config.smoothScroll}
        smoothingTauMs={config.smoothing ?? undefined}
        optimize={config.optimize === "off" ? false : config.optimize === "wait" ? { wait: true } : true}
      >
        {config.sections.map((s) =>
          s.unit === "time" ? (
            <Section key={s.id} id={s.id} fromTime={s.from} toTime={s.to} className="pg-section">
              <h2>{s.text}</h2>
            </Section>
          ) : (
            <Section key={s.id} id={s.id} start={s.from} end={s.to} className="pg-section">
              <h2>{s.text}</h2>
            </Section>
          )
        )}
        <Reporter auto={auto} setAuto={setAuto} />
      </ScrollVideo>
      <div className="pg-end">End of the scroll video</div>
    </>
  );
}
