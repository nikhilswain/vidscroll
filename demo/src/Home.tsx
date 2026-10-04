import { useState } from "react";
import { ScrollVideo, Section } from "vidscroll";
import { CreditLine } from "./CreditLine";
import { SINTEL_CREDIT, SPRING_CREDIT, TRAIN_CREDIT } from "./credits";
import { DEMOS } from "./demos";
import { highlight } from "./highlight";
import { REPO_URL } from "./TopBar";
import "./home.css";

const INSTALL = "npm i vidscroll";

const startPastFadeIn = (t: number) => 0.04 + 0.96 * t;

const SNIPPET = `import { ScrollVideo, Section } from "vidscroll";

<ScrollVideo src="/hero.mp4" length="400vh">
  <Section start={0} end={0.5}>
    <h2>Scroll to play</h2>
  </Section>
</ScrollVideo>`;

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
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function Home() {
  return (
    <main className="home">
      <ScrollVideo
        src="/commute.mp4"
        length="320vh"
        easing={startPastFadeIn}
        smoothScroll
        loader={false}
        className="home-hero"
      >
        <div className="home-hero__shade" aria-hidden="true" />
        <Section start={0} end={0.5} className="home-hero__copy">
          <div className="home-hero__text">
            <h1>vidscroll</h1>
            <p>Video that plays as you scroll. Smooth with any MP4, for React.</p>
            <InstallCommand />
            <a className="home-hero__link" href={REPO_URL} target="_blank" rel="noreferrer">
              Docs and source on GitHub
            </a>
          </div>
        </Section>
        <Section start={0.5} end={1} className="home-hero__copy">
          <div className="home-start">
            <h2>Get started</h2>
            <pre>
              <code>{highlight(SNIPPET)}</code>
            </pre>
            <p>
              Any MP4 works. Videos with sparse keyframes are re-encoded in the browser on the
              first visit, or ahead of time with <code>npx vidscroll encode</code>.{" "}
              <a href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
                Read the guide
              </a>
              .
            </p>
          </div>
        </Section>
        <p className="home-hero__cue" aria-hidden="true">
          Scroll to play
        </p>
      </ScrollVideo>

      <section className="gallery" aria-labelledby="demos-heading">
        <h2 id="demos-heading">Demos</h2>
        <ul className="gallery__grid">
          {DEMOS.map((demo) => (
            <li key={demo.slug}>
              <a className="demo-card" href={`#/${demo.slug}`}>
                <div className="demo-card__poster">
                  <img src={demo.poster} alt="" loading="lazy" width={960} height={540} />
                </div>
                <h3>{demo.title}</h3>
                <p>{demo.description}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="home-footer">
        <p>
          Train animation: <CreditLine credit={TRAIN_CREDIT} />
        </p>
        <p>
          Mountain clip: <CreditLine credit={SPRING_CREDIT} />
        </p>
        <p>
          Snow clip: <CreditLine credit={SINTEL_CREDIT} />
        </p>
        <p>
          MIT licensed.{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
