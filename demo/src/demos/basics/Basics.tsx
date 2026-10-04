import { ScrollVideo, Section } from "vidscroll";
import "./basics.css";

export function Basics() {
  return (
    <main className="basics">
      <header className="basics__text">
        <h1>A scroll video inside a page</h1>
        <p>
          This is ordinary page content. Keep scrolling: the video below pins in place while you
          scroll through it, then the page carries on.
        </p>
      </header>

      <ScrollVideo src="/catAnime.mp4" length="500vh" smoothScroll>
        <Section start={0} end={0.33} className="basics__panel">
          <h2>Intro</h2>
        </Section>
        <Section fromTime={20} toTime={40} className="basics__panel">
          <h2>Middle</h2>
        </Section>
        <Section start={0.66} end={1} className="basics__panel">
          <h2>Outro</h2>
        </Section>
      </ScrollVideo>

      <section className="basics__text">
        <h2>And the page continues</h2>
        <p>
          A page can hold any number of scroll videos. Each one takes up its own <code>length</code>{" "}
          of scrolling and only plays while you pass through it.
        </p>
      </section>

      <ScrollVideo src="/commute.mp4" length="300vh" fit="contain" smoothScroll>
        <Section start={0} end={1} className="basics__panel">
          <h2>A second video</h2>
        </Section>
      </ScrollVideo>

      <footer className="basics__text">
        <p>The end of the page.</p>
      </footer>
    </main>
  );
}
