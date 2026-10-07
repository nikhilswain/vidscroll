import { useState } from "react";
import { ScrollVideo, Section } from "vidscroll";
import { highlight } from "../../../../demo/src/highlight";

const INSTALL = "npm i vidscroll";

const SNIPPET = `import { ScrollVideo, Section } from "vidscroll";

<ScrollVideo src="/hero.mp4" length="400vh">
  <Section start={0} end={0.5}>
    <h2>Scroll to play</h2>
  </Section>
</ScrollVideo>`;

const startPastFadeIn = (t: number) => 0.04 + 0.96 * t;

function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(INSTALL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="install">
      <code>{INSTALL}</code>
      <button type="button" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function Hero({ src, docs, demos }: { src: string; docs: string; demos: string }) {
  return (
    <ScrollVideo src={src} length="320vh" easing={startPastFadeIn} smoothScroll loader={false} className="hero">
      <div className="hero__shade" aria-hidden="true" />
      <Section start={0} end={0.5} className="hero__copy">
        <div className="hero__text">
          <h1>vidscroll</h1>
          <p>
            Video that plays as you scroll, frame by frame. Smooth with any MP4 or WebM, for React and plain
            HTML.
          </p>
          <InstallCommand />
          <div className="hero__links">
            <a className="button button--primary" href={docs}>
              Read the docs
            </a>
            <a className="button" href={demos}>
              See the demos
            </a>
          </div>
        </div>
      </Section>
      <Section start={0.5} end={1} className="hero__copy">
        <div className="hero__start">
          <h2>Get started</h2>
          <div className="code">
            <div className="code__head">
              <span className="code__file">Hero.tsx</span>
            </div>
            <pre>
              <code>{highlight(SNIPPET)}</code>
            </pre>
          </div>
          <p>
            Any MP4 works. Videos with sparse keyframes are re-encoded in the browser on the first visit, or ahead of
            time with <code>npx vidscroll encode</code>.
          </p>
        </div>
      </Section>
      <p className="hero__cue" aria-hidden="true">
        Scroll to play
      </p>
      <div className="hero__line" aria-hidden="true" />
    </ScrollVideo>
  );
}
