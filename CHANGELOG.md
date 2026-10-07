# Changelog

Before 1.0, minor versions (0.2, 0.3) add features and patch versions (0.3.1,
0.3.2) only fix things. Nothing below breaks existing React code.

## 0.3.3 (2026-10-07)

- New documentation site with guides, a reference, a video checker and a
  playground: https://nikhilswain.github.io/vidscroll/
- The README is now a short guide that links to the docs, and the package
  homepage points at the docs site.
- `ScrollFramesProps` no longer lists `preview`, an internal option that
  `ScrollFrames` ignored.

## 0.3.2 (2026-10-07)

- With an explicit `length`, `ScrollVideo` renders its final height from the
  first render, including on the server. Content below the video no longer
  jumps when the page's JavaScript starts.

## 0.3.1 (2026-10-06)

- Fixed: easing presets moved the video backwards near the end of the scroll.
  All presets now move forward only.
- `easing` and `smoothingTauMs` apply immediately when they change; a new
  `fps` rebuilds the scroll mapping; a changed `optimize` value reloads.
- `vidscroll/core`: `update()` now changes only the options you pass, and the
  new `setOptions()` replaces all of them.
- `fullPreload={false}` checks the URL too, and an invalid `length` goes to
  `onError` instead of throwing.
- The error message is shown even with a custom loader.
- CLI: `--fps` is a cap: slower sources keep their frame rate.

## 0.3.0 (2026-10-06)

- **New:** `vidscroll/core`, the plain JavaScript controller behind the React
  component (experimental).
- **New:** `<vid-scroll>` and `<vid-scroll-section>` custom elements for pages
  without React, plus a standalone CDN build (experimental).
- `react` is now an optional peer dependency, so non-React projects don't need
  it.
- Fixed: time-based sections briefly showed at load before the duration was
  known.
- Fixed: the video could freeze after two animation frames with the same
  timestamp.
- Fixed: an active section blocked clicks on content behind its empty area.
- `ScrollVideoApi` gains `addSection` and `removeSection`.

## 0.2.2 (2026-10-05)

- `easing` accepts preset names (`"inOutSine"`, `"outCubic"` and others), which
  also works from Next.js server components.
- Time- and frame-based sections stay on their frames when an easing curve is
  used.

## 0.2.1 (2026-10-05)

- **Scroll while optimizing:** a raw video can be scrolled straight away while
  it's re-encoded in the background, then the smooth copy takes over at the
  same frame. A corner badge shows the progress; `optimize={{ wait: true }}`
  keeps the old behaviour.
- `loader` functions receive the built-in loader as a second argument.
- After fast scrolling, the video glides to a stop instead of jumping.
- On Android, scrolling forward plays the video instead of seeking, which is
  smoother there.

0.2.0 was tagged but never published; its changes are in 0.2.1.

## 0.1.1 (2026-10-04)

The first releases (0.1.0 and 0.1.1): `ScrollVideo`, `Section` and
`ScrollFrames`, in-browser re-encoding with caching, the `vidscroll encode`
CLI, the `useScrollVideoState` and `useScrollVideoUpdate` hooks, and the
`--video-progress` variable.
