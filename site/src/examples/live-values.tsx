import { useRef } from "react";
import { ScrollVideo, useScrollVideoUpdate } from "vidscroll";
import { asset } from "./asset";

function Clock() {
  const ref = useRef<HTMLParagraphElement>(null);
  useScrollVideoUpdate(({ linearProgress }) => {
    const minutes = 7 * 60 + 40 + linearProgress * 35;
    const text = `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
    if (ref.current && ref.current.textContent !== text) ref.current.textContent = text;
  });
  return <p ref={ref} style={{ margin: 0, color: "#fff", font: "500 40px monospace" }}>7:40</p>;
}

function Ring() {
  const ref = useRef<SVGCircleElement>(null);
  useScrollVideoUpdate(({ linearProgress }) => {
    ref.current?.setAttribute("stroke-dashoffset", String(1 - linearProgress));
  });
  return (
    <svg viewBox="0 0 100 100" width="88" height="88" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="6" />
      <circle
        ref={ref}
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#f6b98e"
        strokeWidth="6"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset="1"
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="400vh">
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <Ring />
        <Clock />
      </div>
    </ScrollVideo>
  );
}
