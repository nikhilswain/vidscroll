# vidscroll

Scroll-scrubbed video for React, with an experimental custom element for any
other page. Scrolling moves a video frame by frame, with text sections that
fade in and out along the way.

- **Smooth on any video file.** Most exported videos have keyframes several
  seconds apart, which makes every seek slow. vidscroll detects that and
  re-encodes the video in the browser on the first visit, then caches the
  result. Visitors can scroll the video while that runs, and later visits
  load instantly.
- **Or skip the wait:** `npx vidscroll encode hero.mp4` prepares the file ahead
  of time.
- **Content in sync:** sections between two points, captions timed to the
  footage, and CSS variables that follow the scroll, without scroll code.
- Clear errors for things that can't work, like YouTube links or a wrong path.

**[Documentation](https://vidscroll.js.org/docs/start/introduction/)** ·
**[Demos](https://vidscroll.js.org/#demos)**

```bash
npm i vidscroll
```

## Quick start

```tsx
import { ScrollVideo, Section } from "vidscroll";

export default function Hero() {
  return (
    <ScrollVideo src="/videos/hero.mp4" length="400vh" smoothScroll>
      <Section start={0} end={0.33}>
        <h1>Intro</h1>
      </Section>
      <Section start={0.33} end={0.66}>
        <h1>Middle</h1>
      </Section>
      <Section start={0.66} end={1}>
        <h1>Outro</h1>
      </Section>
    </ScrollVideo>
  );
}
```

`src` is any URL to a video file: your public folder, a CDN, or a bundler
import (`import heroUrl from "./hero.mp4"`).

`<ScrollVideo>` is a block in your page like any other. It takes up its
`length` of scrolling plus one screen; while you scroll through it, the
video stays pinned to the viewport and plays, then the page carries on. Put
content above and below it, or use several on one page. Set `length`
explicitly when there's content below the video, so nothing moves once the
video loads.

### Next.js

The package is marked `"use client"`, so you can import `ScrollVideo` and
`Section` straight into a server component such as `page.tsx`. Server
components can only pass plain data, so give `easing` by name
(`easing="outCubic"`), and put callbacks (`onLoad`, `onError`, a `loader`
function) and the hooks in your own component that starts with
`"use client"`. [More on Next.js →](https://vidscroll.js.org/docs/get-started/nextjs/)

## Your video

Both ways scrub smoothly; they differ only in a visitor's **first** visit.

| | Use the raw video | Prepare it with the CLI |
| --- | --- | --- |
| Setup | None | One command per video |
| First visit | Scrubs right away, choppy scrolling back until the browser has re-encoded it (about 10 s for a 60 s 1080p clip on a desktop; longer on phones) | Just the download |
| Later visits | Instant (cached) | Instant |
| Best for | Trying things out, user-uploaded videos | Production sites |

To prepare a video, make ffmpeg available (`npm i -D ffmpeg-static`, a
system-wide install, or `FFMPEG_PATH`), then:

```bash
npx vidscroll encode public/videos/hero.mp4
# writes public/videos/hero.scroll.mp4
```

Use `hero.scroll.mp4` as the `src`. vidscroll sees that it's already prepared
and uses it as-is. Options: `--resolution` (default 720), `--gop`, `--crf`
and `--fps`. [CLI reference →](https://vidscroll.js.org/docs/reference/cli/)

`src` must be a video file. YouTube or Vimeo page links, HLS/DASH streams
and wrong paths show an error. A file on another domain needs CORS headers
to be checked and optimized; without them it plays, but only scrubs smoothly
if prepared with the CLI.

## `<ScrollVideo>` props

| Prop | Default | Description |
| --- | --- | --- |
| `src` | required | Video file URL |
| `length` | `"auto"` | Scrolling for the whole video: `"400vh"`, `"2000px"` or a number of px. `"auto"` is 40vh per second of video |
| `optimize` | `true` | Re-encode slow-to-seek videos in the browser. `false` to turn off, or options such as `{ wait: true }` to keep the loader up until the smooth copy is ready |
| `smoothScroll` | `false` | Eased mouse-wheel scrolling for the page |
| `fit` | `"cover"` | `"cover"` fills the screen and crops; `"contain"` shows the whole frame |
| `easing` | `"none"` | Curve from scroll to video time: a preset name (`"inOutSine"`, `"outCubic"`, …) or a function |
| `poster` | first frame | Image shown while loading, or `false` for none |
| `loader` | built-in | `false`, a React node, or `(state, builtIn) => node` |
| `onLoad`, `onError` | | Called once the video is ready, or with a `VidscrollError` |

[All props, including `fps`, `fullPreload` and smoothing →](https://vidscroll.js.org/docs/react/scroll-video/)

## Sections and styling

A `<Section>` is active over part of the video, given as scroll progress
(`start`/`end`, 0–1), seconds of video (`fromTime`/`toTime`) or frames
(`fromFrame`/`toFrame`). By default it covers the video, centres its
content and fades in while active.

There's no stylesheet to import, and the default rules have zero
specificity, so your CSS wins without `!important`. Each section has
`data-active` while active and a `--progress` variable that goes from 0 to 1
across its range, so plain CSS can animate anything as you scroll:

```css
.caption {
  opacity: calc(1 - var(--progress));
  transform: translateY(calc(var(--progress) * -40px));
}
```

The outer block carries `--video-progress` (0–1 across the whole video) for
anything else, like a progress bar.
[Section →](https://vidscroll.js.org/docs/react/section/) ·
[Styling reference →](https://vidscroll.js.org/docs/reference/styling/)

## Hooks

Inside a `ScrollVideo`:

- `useScrollVideoState()` returns `{ ready, progress, time, frame, activeSections }`
  and re-renders as they change.
- `useScrollVideoUpdate(callback)` runs on every frame without re-rendering,
  for writing to the DOM through refs.
- `useScrollVideo().api` has actions such as `scrollToTime(seconds)`, which
  scrolls the page to a point in the video, for chapter buttons.

```tsx
function Timecode() {
  const { time, ready } = useScrollVideoState();
  return <span>{ready ? time.toFixed(1) : "–"}s</span>;
}
```

[Hooks →](https://vidscroll.js.org/docs/react/hooks/)

## Image sequences

If you already have frames as images, `<ScrollFrames>` draws them to a canvas
with no video decoding:

```tsx
<ScrollFrames urls="/frames/frame_{i4}.webp" count={240} />
```

## Without React (experimental)

The `<vid-scroll>` element does the same on any page:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vidscroll@0.3/dist/cdn/vidscroll-element.js"></script>

<vid-scroll src="/videos/hero.mp4" length="400vh" easing="inOutSine" smooth-scroll>
  <vid-scroll-section from-time="0" to-time="4">
    <h1>Open water</h1>
  </vid-scroll-section>
</vid-scroll>
```

With a bundler, `import "vidscroll/element"` instead. Attributes match the
React props in kebab-case. For full control, `vidscroll/core` exposes the
controller behind both.
[&lt;vid-scroll&gt; →](https://vidscroll.js.org/docs/without-react/element/) ·
[vidscroll/core →](https://vidscroll.js.org/docs/without-react/core/)

## Good to know

- **Length:** best under about 2 minutes. Longer videos make very long pages
  and slow first loads.
- **Size:** every visitor downloads the whole file before scrolling unlocks.
- **Audio** is never played and is dropped when re-encoding.
- **Browsers:** scrubbing works in all modern browsers. In-browser
  re-encoding needs WebCodecs (Chrome and Edge 94+, Firefox 130+ on desktop,
  Safari 16.4+); elsewhere, prepare videos with the CLI. Real Safari and iOS
  haven't been tested yet.
  [Browser support →](https://vidscroll.js.org/docs/reference/browser-support/)
- Everything is typed in TypeScript.

Something not working? See
[Troubleshooting](https://vidscroll.js.org/docs/troubleshooting/).

## Credits

The train animation used in the demos is
["30 second animation assignment"](https://www.youtube.com/watch?v=_Td7JjCTfyc)
by [roenais](https://www.youtube.com/@roenais).

## License

MIT
