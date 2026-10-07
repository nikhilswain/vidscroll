import { useState } from "react";
import { ScrollVideo, useScrollVideo, useScrollVideoUpdate } from "vidscroll";
import { asset } from "./asset";

const CHAPTERS = [
  { title: "Doors", at: 0 },
  { title: "Carriage", at: 4 },
  { title: "Open water", at: 12 },
  { title: "Away", at: 24 },
];

const css = `
  .chapters {
    position: absolute;
    top: 50%;
    right: 16px;
    display: grid;
    gap: 4px;
    translate: 0 -50%;
    pointer-events: auto;
  }
  .chapters button[aria-current="true"] {
    border-color: #f6b98e;
    color: #f6b98e;
  }
`;

function ChapterNav() {
  const { api } = useScrollVideo();
  const [current, setCurrent] = useState(0);

  useScrollVideoUpdate(({ time }) => {
    let index = 0;
    CHAPTERS.forEach((chapter, i) => {
      if (time >= chapter.at) index = i;
    });
    setCurrent(index);
  });

  return (
    <nav className="chapters" aria-label="Chapters">
      {CHAPTERS.map((chapter, i) => (
        <button key={chapter.title} aria-current={i === current} onClick={() => api?.scrollToTime(chapter.at + 0.5)}>
          {chapter.title}
        </button>
      ))}
    </nav>
  );
}

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="500vh">
      <style>{css}</style>
      <ChapterNav />
    </ScrollVideo>
  );
}
