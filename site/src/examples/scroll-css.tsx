import { ScrollVideo, Section } from "vidscroll";
import { asset } from "./asset";

const css = `
  .iris__mask {
    position: absolute;
    inset: 0;
    --r: calc(var(--progress) * 80vmax);
    background: radial-gradient(circle, transparent var(--r), #000 var(--r));
  }
  .iris h2 {
    position: relative;
    opacity: calc(1 - var(--progress) * 2);
  }
  .progress-bar {
    position: absolute;
    inset: auto 0 0 0;
    height: 3px;
    background: #f6b98e;
    transform-origin: left;
    transform: scaleX(var(--video-progress));
  }
`;

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="400vh">
      <style>{css}</style>
      <Section id="iris" start={0} end={0.2} className="iris">
        <div className="iris__mask" />
        <h2>The Commute</h2>
      </Section>
      <div className="progress-bar" />
    </ScrollVideo>
  );
}
