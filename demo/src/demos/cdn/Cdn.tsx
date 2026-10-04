import { useState } from "react";
import { ScrollVideo, Section } from "vidscroll";
import type { ScrollVideoProps } from "vidscroll";
import { CreditLine } from "../../CreditLine";
import { SINTEL_CREDIT } from "../../credits";
import "./cdn.css";

const SRC = "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4";

type Source = Parameters<NonNullable<ScrollVideoProps["onLoad"]>>[0]["source"];

const EXPLANATION: Record<Source, string> = {
  stream:
    "Streamed straight from the other site. Its server doesn't send CORS headers, so this page isn't allowed to read the file to check or re-encode it. The browser seeks in it directly, which is slower for a video with few keyframes.",
  original: "Downloaded in full and used as-is: its keyframes are already close enough for smooth seeking.",
  optimized: "Downloaded and re-encoded in this browser for smooth seeking.",
  cache: "Loaded from this browser's cache of an earlier re-encode.",
};

export function Cdn() {
  const [source, setSource] = useState<Source | null>(null);
  return (
    <ScrollVideo src={SRC} length="500vh" smoothScroll onLoad={(info) => setSource(info.source)}>
      <div className="cdn-shade" aria-hidden="true" />
      <Section start={0} end={0.3} className="cdn-title">
        <div>
          <h1>Sintel</h1>
          <p>A 10-second clip loaded from another website.</p>
        </div>
      </Section>
      <aside className="cdn-status" aria-live="polite">
        <h2>How this video is served</h2>
        <p className="cdn-status__source">{source ?? "loading…"}</p>
        {source && <p>{EXPLANATION[source]}</p>}
        <p className="cdn-status__url">{new URL(SRC).host}</p>
      </aside>
      <p className="cdn-credit">
        <CreditLine credit={SINTEL_CREDIT} />
      </p>
    </ScrollVideo>
  );
}
