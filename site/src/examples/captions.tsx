import type { CSSProperties } from "react";
import { ScrollVideo, Section } from "vidscroll";
import { asset } from "./asset";

const lines = ["The carriage hums.", "The window fogs.", "Somewhere, the sea."];

const css = `
  .caption {
    align-items: flex-end;
    padding-bottom: 10vh;
  }
  .caption p,
  .stanza p {
    text-shadow: 0 1px 8px rgb(0 0 0 / 0.6);
  }
  .caption p {
    margin: 0;
    color: #fff;
    font-size: 28px;
    opacity: clamp(0, min(var(--progress) / 0.15, (1 - var(--progress)) / 0.15), 1);
  }
  .stanza p {
    margin: 0.2em 0;
    color: #fff;
    font-size: 34px;
    text-align: center;
    --enter: clamp(0, (var(--progress) / 0.32 * (var(--n) + 1) - var(--i)) / 2, 1);
    --exit: clamp(0, ((var(--progress) - 0.56) / 0.38 * (var(--n) + 1) - var(--i)) / 2, 1);
    opacity: calc(var(--enter) - var(--exit));
    transform: translateY(calc((1 - var(--enter)) * 1.1em - var(--exit) * 1.3em));
  }
`;

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="500vh">
      <style>{css}</style>
      <Section id="doors" fromTime={1} toTime={6} className="caption">
        <p>Doors close. Another morning.</p>
      </Section>
      <Section id="stanza" start={0.45} end={0.85}>
        <div className="stanza" style={{ "--n": lines.length } as CSSProperties}>
          {lines.map((line, i) => (
            <p key={line} style={{ "--i": i } as CSSProperties}>
              {line}
            </p>
          ))}
        </div>
      </Section>
    </ScrollVideo>
  );
}
