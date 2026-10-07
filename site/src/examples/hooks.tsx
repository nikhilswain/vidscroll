import { useRef } from "react";
import { ScrollVideo, useScrollVideo, useScrollVideoState, useScrollVideoUpdate } from "vidscroll";
import { asset } from "./asset";

function Timecode() {
  const { time, ready } = useScrollVideoState();
  return <p style={{ margin: 0, font: "500 32px monospace" }}>{ready ? time.toFixed(1) : "–"} s</p>;
}

function ProgressBar() {
  const bar = useRef<HTMLDivElement>(null);
  useScrollVideoUpdate(({ linearProgress }) => {
    if (bar.current) bar.current.style.transform = `scaleX(${linearProgress})`;
  });
  return (
    <div
      ref={bar}
      style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 4, background: "#f6b98e", transformOrigin: "left" }}
    />
  );
}

function Chapters() {
  const { api } = useScrollVideo();
  return (
    <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
      <button onClick={() => api?.scrollToTime(1)}>Doors</button>
      <button onClick={() => api?.scrollToTime(13)}>Open water</button>
      <button onClick={() => api?.scrollToTime(25)}>Away</button>
    </div>
  );
}

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="400vh">
      <div style={{ position: "absolute", top: 16, left: 16, display: "grid", gap: 12, color: "#fff" }}>
        <Timecode />
        <Chapters />
      </div>
      <ProgressBar />
    </ScrollVideo>
  );
}
