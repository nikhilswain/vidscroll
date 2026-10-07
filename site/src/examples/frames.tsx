import { ScrollFrames, Section } from "vidscroll";
import { asset } from "./asset";

export default function Example() {
  return (
    <ScrollFrames urls={asset("frames/train/{i3}.webp")} count={87} length="300vh">
      <Section id="stills" start={0} end={0.4}>
        <h2>87 still images</h2>
      </Section>
      <Section id="water" fromFrame={50} toFrame={75}>
        <h2>Frames 50 to 75</h2>
      </Section>
    </ScrollFrames>
  );
}
