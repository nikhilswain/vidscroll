import { ScrollVideo, Section } from "vidscroll";
import { asset } from "./asset";

export default function Example() {
  return (
    <ScrollVideo src={asset("train.mp4")} length="400vh">
      <Section id="doors" start={0} end={0.3}>
        <h2>Doors close</h2>
      </Section>
      <Section id="water" start={0.55} end={0.9}>
        <h2>Open water</h2>
      </Section>
    </ScrollVideo>
  );
}
