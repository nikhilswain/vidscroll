import { useEffect, useRef } from "react";
import { ScrollVideo, useScrollVideo } from "vidscroll";
import "./almanac.css";

const START_MIN = 18 * 60 + 42;
const SPAN_MIN = 49;
const SUNSET_AT = 43 / SPAN_MIN;

const pad = (n: number) => String(n).padStart(2, "0");

function readings(p: number) {
  const minutes = START_MIN + p * SPAN_MIN;
  const left = Math.max(0, Math.round((SUNSET_AT - p) * SPAN_MIN));
  return {
    clock: `${pad(Math.floor(minutes / 60))}:${pad(Math.floor(minutes % 60))}`,
    phase: p < SUNSET_AT ? "Golden hour" : "Sunset",
    altitude: `${(6 * (1 - p / SUNSET_AT)).toFixed(1)}°`,
    daylight: left > 0 ? `${left} min` : "None",
    temperature: `${(24 - 4.4 * p).toFixed(1)} °C`,
  };
}

type Field = keyof ReturnType<typeof readings>;

function Readout() {
  const { api } = useScrollVideo();
  const fields = useRef<Partial<Record<Field, HTMLElement | null>>>({});
  const trail = useRef<SVGPathElement>(null);
  const sun = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!api) return;
    const path = trail.current!;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;

    const onUpdate = ({ linearProgress: p }: { linearProgress: number }) => {
      const values = readings(p);
      for (const key of Object.keys(values) as Field[]) {
        const el = fields.current[key];
        if (el && el.textContent !== values[key]) el.textContent = values[key];
      }
      const point = path.getPointAtLength(p * length);
      sun.current?.setAttribute("cx", point.x.toFixed(2));
      sun.current?.setAttribute("cy", point.y.toFixed(2));
      path.style.strokeDashoffset = `${length * (1 - p)}`;
    };
    onUpdate({ linearProgress: api.getState().linearProgress });
    api.on("update", onUpdate);
    return () => api.off("update", onUpdate);
  }, [api]);

  const bind = (key: Field) => (el: HTMLElement | null) => {
    fields.current[key] = el;
  };
  const initial = readings(0);

  return (
    <aside className="almanac" aria-label="Evening almanac">
      <h1 className="almanac__heading">Evening almanac</h1>
      <p className="almanac__clock" ref={bind("clock")}>
        {initial.clock}
      </p>
      <p className="almanac__phase" ref={bind("phase")}>
        {initial.phase}
      </p>

      <svg className="almanac__sky" viewBox="0 0 240 96" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
        <path className="almanac__path" d="M 10 18 Q 150 22 230 92" />
        <path ref={trail} className="almanac__trail" d="M 10 18 Q 150 22 230 92" />
        <line className="almanac__horizon" x1="0" y1="78" x2="240" y2="78" />
        <circle ref={sun} className="almanac__sun" cx="10" cy="18" r="6" />
      </svg>

      <dl className="almanac__stats">
        <div>
          <dt>Sun altitude</dt>
          <dd ref={bind("altitude")}>{initial.altitude}</dd>
        </div>
        <div>
          <dt>Daylight left</dt>
          <dd ref={bind("daylight")}>{initial.daylight}</dd>
        </div>
        <div>
          <dt>Temperature</dt>
          <dd ref={bind("temperature")}>{initial.temperature}</dd>
        </div>
      </dl>
    </aside>
  );
}

export function Almanac() {
  return (
    <ScrollVideo src="/catAnime.mp4" pixelsPerFrame={8} bufferFrames={6} smoothScroll>
      <div className="almanac-shade" aria-hidden="true" />
      <Readout />
    </ScrollVideo>
  );
}
