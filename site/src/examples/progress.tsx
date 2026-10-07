import { ScrollVideo, Section } from "vidscroll";
import { asset } from "./asset";

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="400vh">
      <Section id="caption" start={0.1} end={0.9}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 240, height: 4, margin: "0 auto 32px", background: "rgb(255 255 255 / 0.25)" }}>
            <div style={{ width: "calc(var(--progress) * 100%)", height: "100%", background: "#f6b98e" }} />
          </div>
          <h2 style={{ transform: "translateY(calc((1 - var(--progress)) * 80px))" }}>
            Rising with the scroll
          </h2>
        </div>
      </Section>
    </ScrollVideo>
  );
}
