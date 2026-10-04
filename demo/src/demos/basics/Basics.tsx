import { ScrollVideo, Section } from "vidscroll";
import "./basics.css";

export function Basics() {
  return (
    <ScrollVideo
      src="/catAnime.mp4"
      pixelsPerFrame={10}
      bufferFrames={6}
      smoothScroll
      sectionDisplayMode="crossfade"
      crossfadeDurationMs={600}
    >
      <Section id="intro" start={0} end={0.33} className="panel">
        <h1>Intro</h1>
      </Section>
      <Section id="mid" fromTime={20} toTime={40} className="panel">
        <h1>Middle</h1>
      </Section>
      <Section id="outro" start={0.66} end={1} className="panel">
        <h1>Outro</h1>
      </Section>
    </ScrollVideo>
  );
}
