import { useState } from "react";
import { ScrollVideo } from "vidscroll";

const src = "https://cdn.jsdelivr.net/gh/nikhilswain/vidscroll@v0.3.2/demo/public/train.mp4";

export default function Example() {
  const [source, setSource] = useState("loading");
  return (
    <ScrollVideo src={src} length="400vh" onLoad={(info) => setSource(info.source)}>
      <p style={{ position: "absolute", top: 16, left: 16, margin: 0, color: "#fff", font: "500 18px monospace" }}>
        served as: {source}
      </p>
    </ScrollVideo>
  );
}
