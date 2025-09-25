import React, { useRef, useEffect } from "react";
import "../index.css";

// Tunable constants
const ASSUMED_FPS = 30; // adjust if your source video has different frame rate
const PIXELS_PER_FRAME = 12; // scroll granularity per frame
const END_BUFFER_FRAMES = 2; // extra frames worth of scroll so last frame is reachable

export default function VideoScroll() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const spacer = spacerRef.current;
    if (!video || !spacer) return;

    let totalFrames = 0;
    let lastAppliedFrame = -1;
    let rafScheduled = false;

    const recomputeLayout = () => {
      if (!video.duration) return;
      totalFrames = Math.round(video.duration * ASSUMED_FPS);
      const scrollHeight =
        (totalFrames + END_BUFFER_FRAMES) * PIXELS_PER_FRAME +
        window.innerHeight;
      spacer.style.height = `${scrollHeight}px`;
    };

    const applyFrameFromScroll = () => {
      rafScheduled = false;
      if (!video.duration) return;
      const maxScrollable = spacer.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;
      const progress = Math.min(Math.max(scrollY / maxScrollable, 0), 1);
      const exactFrame = progress * totalFrames;
      const frameIndex = Math.min(
        totalFrames - 1,
        Math.max(0, Math.round(exactFrame))
      );
      if (frameIndex === lastAppliedFrame) return; // no change needed
      lastAppliedFrame = frameIndex;
      const targetTime = (frameIndex / totalFrames) * video.duration;
      video.currentTime = targetTime;
    };

    const onScroll = () => {
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(applyFrameFromScroll);
      }
    };

    const onVideoReady = () => {
      video.pause();
      video.currentTime = 0;
      recomputeLayout();
      applyFrameFromScroll();
    };

    if (video.readyState >= 1) {
      onVideoReady();
    } else {
      video.addEventListener("loadedmetadata", onVideoReady);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recomputeLayout);

    return () => {
      video.removeEventListener("loadedmetadata", onVideoReady);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recomputeLayout);
    };
  }, []);

  return (
    <>
      <div className="video-container" style={{ position: "fixed", inset: 0 }}>
        <video
          ref={videoRef}
          className="video-element"
          src="/animate.mp4"
          preload="metadata"
          muted
          playsInline
        />
      </div>
      <div ref={spacerRef} />
    </>
  );
}
