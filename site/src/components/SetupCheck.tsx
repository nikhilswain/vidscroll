import { ScrollVideo, Section } from "vidscroll";

export function SetupCheck({ src }: { src: string }) {
  return (
    <ScrollVideo src={src} length="300vh" fit="contain">
      <Section start={0} end={0.5}>
        <h2 style={{ color: "#fff" }}>React island</h2>
      </Section>
    </ScrollVideo>
  );
}
