import { useState } from "react";
import { ScrollVideo, Section } from "vidscroll";
import type { ScrollVideoProps } from "vidscroll";
import { CreditLine } from "../../CreditLine";
import { SINTEL_CREDIT, SPRING_CREDIT } from "../../credits";
import type { Credit } from "../../credits";
import "./cdn.css";

const SPRING_SRC = "https://cdn.jsdelivr.net/gh/nikhilswain/vidscroll@main/demo/cdn/spring-excerpt.webm";
const SINTEL_SRC = "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4";

type Source = Parameters<NonNullable<ScrollVideoProps["onLoad"]>>[0]["source"];

const EXPLANATION: Record<Source, string> = {
  optimized:
    "Downloaded (the server allows it with CORS), found to have keyframes far apart, and re-encoded in this browser for smooth seeking. Later visits use the cached copy.",
  cache: "Loaded from this browser's cache: it was re-encoded on an earlier visit.",
  original: "Downloaded in full and used as-is: its keyframes are already close enough for smooth seeking.",
  stream:
    "Streamed straight from the other site. Its server doesn't send CORS headers, so this page isn't allowed to read the file to check or re-encode it. The browser seeks in it directly, which is slower for a video with few keyframes.",
};

function CdnVideo({ src, title, length, credit }: { src: string; title: string; length: string; credit: Credit }) {
  const [source, setSource] = useState<Source | null>(null);
  return (
    <ScrollVideo src={src} length={length} smoothScroll onLoad={(info) => setSource(info.source)}>
      <div className="cdn-shade" aria-hidden="true" />
      <Section start={0} end={0.3} className="cdn-title">
        <div>
          <h2>{title}</h2>
          <p>{new URL(src).host}</p>
        </div>
      </Section>
      <aside className="cdn-status" aria-live="polite">
        <h3>How this video is served</h3>
        <p className="cdn-status__source">{source ?? "loading…"}</p>
        {source && <p>{EXPLANATION[source]}</p>}
      </aside>
      <p className="cdn-credit">
        <CreditLine credit={credit} />
      </p>
    </ScrollVideo>
  );
}

export function Cdn() {
  return (
    <main className="cdn">
      <header className="cdn__text">
        <h1>Videos from a CDN</h1>
        <p>
          Both clips on this page come from other websites. Whether a server sends CORS headers decides
          what vidscroll can do with its videos. Watch the panel on each one.
        </p>
      </header>

      <CdnVideo src={SPRING_SRC} title="Spring" length="900vh" credit={SPRING_CREDIT} />

      <section className="cdn__text">
        <h2>Without CORS</h2>
        <p>
          The next server doesn't allow other sites to read its files. The video still plays and
          scrubs, but vidscroll can't check or re-encode it, and this clip has a single keyframe, so
          every seek decodes from the start.
        </p>
      </section>

      <CdnVideo src={SINTEL_SRC} title="Sintel" length="400vh" credit={SINTEL_CREDIT} />

      <footer className="cdn__text">
        <p>
          To scrub smoothly from any CDN, serve videos with an <code>Access-Control-Allow-Origin</code>{" "}
          header, or prepare them with <code>npx vidscroll encode</code> before uploading.
        </p>
      </footer>
    </main>
  );
}
