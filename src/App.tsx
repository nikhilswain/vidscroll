import { ScrollVideo, Section } from "./lib";
import "./index.css";
import { easing } from "./lib/core/easing";

function App() {
  return (
    <ScrollVideo
      easing={easing.inOutQuad}
      src="/animate.mp4"
      pixelsPerFrame={10}
      bufferFrames={6}
      fps={30}
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
        start={0.33}
        end={0.66}
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
