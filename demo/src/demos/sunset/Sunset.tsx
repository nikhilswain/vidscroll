import type { CSSProperties } from "react";
import { ScrollVideo, Section } from "vidscroll";
import type { LoaderState } from "vidscroll";
import "./sunset.css";

const LEFT = [
  "Every evening, the same fence,",
  "the same warm wood beneath the paws.",
  "The birds go home first —",
  "they always know the way.",
  "The cat stays.",
];

const RIGHT = [
  "It isn't waiting for anything.",
  "It only watches the sun",
  "settle, slowly,",
  "into the pink hills.",
  "One late bird hurries home.",
];

const CODA = ["Not every sunset needs a witness.", "This one has one anyway."];

function Stanza({ lines, className }: { lines: string[]; className: string }) {
  return (
    <div className={`stanza ${className}`} style={{ "--n": lines.length } as CSSProperties}>
      {lines.map((line, i) => (
        <p key={i} className="stanza__line" style={{ "--i": i } as CSSProperties}>
          {line}
        </p>
      ))}
    </div>
  );
}

const PHASE_TEXT: Record<LoaderState["phase"], string> = {
  download: "Loading the video",
  optimize: "Preparing smooth scrolling (first visit only)",
  preparing: "Almost there",
  error: "",
};

function Loader({ phase, progress, background, error }: LoaderState) {
  if (background) {
    return (
      <p className="sunset-loader-badge">
        Smoothing scrubbing <span>{Math.round(progress * 100)}%</span>
      </p>
    );
  }
  return (
    <div className="sunset-loader">
      <p className="sunset-loader__title">A Small Vigil</p>
      {error ? (
        <p className="sunset-loader__status">{error.message}</p>
      ) : (
        <>
          <div className="sunset-loader__bar">
            <div style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="sunset-loader__status">
            <span>{PHASE_TEXT[phase]}</span>
            <span>{Math.round(progress * 100)}%</span>
          </p>
        </>
      )}
    </div>
  );
}

export function Sunset() {
  return (
    <ScrollVideo
      src="/catAnime.mp4"
      length="2400vh"
      smoothScroll
      loader={(state) => <Loader {...state} />}
    >
      <div className="sunset-progress" aria-hidden="true" />

      <Section id="title" start={0} end={0.07} className="scene scene--title">
        <div className="shade" />
        <div className="title">
          <h1>A Small Vigil</h1>
          <p>Scroll slowly.</p>
        </div>
      </Section>

      <Section id="left" start={0.09} end={0.42} className="scene scene--left">
        <div className="shade" />
        <Stanza lines={LEFT} className="stanza--left" />
      </Section>

      <Section id="right" start={0.5} end={0.88} className="scene scene--right">
        <div className="shade" />
        <Stanza lines={RIGHT} className="stanza--right" />
      </Section>

      <Section id="coda" start={0.88} end={1} className="scene scene--coda">
        <div className="shade" />
        <Stanza lines={CODA} className="stanza--coda" />
      </Section>
    </ScrollVideo>
  );
}
