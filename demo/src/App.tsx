import { ScrollVideo, Section } from "vidscroll";
import "./index.css";

function App() {
  return (
    <ScrollVideo
      src="/catAnime.mp4"
      pixelsPerFrame={10}
      bufferFrames={6}
      fps={30}
      smoothScroll
      sectionDisplayMode="crossfade"
      crossfadeDurationMs={600}
    >
      <Section
        id="intro"
        start={0}
        end={0.33}
        className="panel"
        activeClassName="active"
      >
        <h1>Intro</h1>
      </Section>
      <Section
        id="mid"
        fromTime={20}
        toTime={40}
        className="panel"
        activeClassName="active"
      >
        <h1>Middle</h1>
      </Section>
      <Section
        id="outro"
        start={0.66}
        end={1}
        className="panel"
        activeClassName="active"
      >
        <h1>Outro</h1>
      </Section>
    </ScrollVideo>
  );
}

export default App;
