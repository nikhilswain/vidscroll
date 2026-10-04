import { useState, useSyncExternalStore } from "react";
import { ScrollVideo, Section, useScrollVideo, useScrollVideoUpdate } from "vidscroll";
import { TRAIN_CREDIT } from "../../credits";
import "./commute.css";

const CHAPTERS = [
  { title: "Doors", at: 0 },
  { title: "Carriage", at: 4.6 },
  { title: "Daydream", at: 9.48 },
  { title: "Open water", at: 12.18 },
  { title: "Setting sail", at: 17.95 },
  { title: "Away", at: 25.06 },
];

const CAPTIONS = [
  { from: 1.4, to: 4.3, text: "The 7:40, again." },
  { from: 5.0, to: 9.3, text: "Same seat. Same strangers. Same window that never opens." },
  { from: 9.6, to: 12.0, text: "She closes her eyes." },
  { from: 12.3, to: 14.5, text: "When she opens them, the air tastes of salt." },
  { from: 14.7, to: 17.8, text: "A boat is waiting, as if it always was." },
  { from: 18.0, to: 21.3, text: "Her hands know the ropes. She never learned them." },
  { from: 21.6, to: 24.9, text: "The sail goes up." },
  { from: 25.2, to: 29.8, text: "Somewhere behind her, a train arrives without her." },
];

const PORTRAIT = "(max-aspect-ratio: 1/1)";

function usePortrait() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(PORTRAIT);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => matchMedia(PORTRAIT).matches
  );
}

function ChapterRail() {
  const { api } = useScrollVideo();
  const [current, setCurrent] = useState(0);

  useScrollVideoUpdate(({ time }) => {
    let index = 0;
    CHAPTERS.forEach((c, i) => {
      if (time >= c.at - 0.05) index = i;
    });
    setCurrent(index);
  });

  return (
    <nav className="chapters" aria-label="Chapters">
      <ol>
        {CHAPTERS.map((chapter, i) => (
          <li key={chapter.title}>
            <button
              type="button"
              aria-current={i === current ? "step" : undefined}
              onClick={() => api?.scrollToTime(chapter.at && chapter.at + 0.6)}
            >
              <span className="chapters__num">{i + 1}</span>
              <span className="chapters__title">{chapter.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Commute() {
  const portrait = usePortrait();
  return (
    <ScrollVideo
      src="/commute.mp4"
      fit={portrait ? "contain" : "cover"}
      length="1700vh"
      smoothScroll
      loader={({ progress, error }) => (
        <div className="commute-loader">
          <p className="commute-loader__title">The Commute</p>
          <p>{error ? error.message : `${Math.round(progress * 100)}%`}</p>
        </div>
      )}
    >
      <Section id="iris" start={0} end={0.07} className="iris">
        <div className="iris__mask" />
        <div className="iris__title">
          <h1>The Commute</h1>
          <p>A daydream in six scenes</p>
        </div>
      </Section>

      <div className="letterbox letterbox--top" aria-hidden="true" />
      <div className="letterbox letterbox--bottom" aria-hidden="true" />

      {CAPTIONS.map((c) => (
        <Section key={c.from} fromTime={c.from} toTime={c.to} className="caption">
          <p>{c.text}</p>
        </Section>
      ))}

      <ChapterRail />

      <p className="commute-credit">
        Animation:{" "}
        <a href={TRAIN_CREDIT.href} target="_blank" rel="noreferrer">
          “{TRAIN_CREDIT.work}”
        </a>{" "}
        by {TRAIN_CREDIT.author}
      </p>
    </ScrollVideo>
  );
}
