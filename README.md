# vidscroll

Scroll-scrubbed video for React. Scrolling moves a video frame by frame, with
text sections that fade in and out along the way.

- **Smooth on any video file.** Most exported videos have keyframes several
  seconds apart, which makes every seek slow. vidscroll detects that and
  re-encodes the video in the browser (WebCodecs) on the first visit, then
  caches the result. Visitors can scroll the video while that runs, and later
  visits load instantly.
- **Or skip the wait:** `npx vidscroll encode hero.mp4` prepares the file ahead
  of time.
- Clear errors for things that can't work, like YouTube links or a wrong path.

**[See the demos →](https://vidscroll.ze-ro.workers.dev)**

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
content above and below it, or use several on one page.

## Using your video

There are two ways. Both scrub smoothly; they differ only in what happens on
a visitor's **first** visit.

| | Option 1: raw video | Option 2: prepare with the CLI |
| --- | --- | --- |
| Setup | None | Run one command per video |
| First visit | Scrubs right away: smooth scrolling forward, choppy scrolling back, until the browser has re-encoded it (about 10 s for a 60 s 1080p clip on a desktop; longer on phones) | Just the download |
| Later visits | Instant (cached) | Instant |
| Best for | Trying things out, user-uploaded videos | Production sites |

### Option 1: use the raw video

Pass its URL. That's all:

```tsx
<ScrollVideo src="/videos/hero.mp4" />
```

If the video isn't encoded for scrubbing (most exports aren't), vidscroll
re-encodes it in the browser and caches the result. Meanwhile the original is
already on screen, with a small "Optimizing video" badge in the corner.
Scrolling forward plays it smoothly. Scrolling back jumps a few frames per
second, because a video can only play forwards. When the re-encoded copy is
ready it takes over at the same frame, and scrubbing turns smooth both ways. To
keep the video hidden behind a progress bar until then instead, pass
`optimize={{ wait: true }}`.

The browser console shows a hint like this. It's a suggestion, not an error:

```
[vidscroll] "/videos/hero.mp4" isn't encoded for scrubbing (keyframes are up
to 8.3s apart); re-encoding it in the browser. Pre-encode it with
`npx vidscroll encode <file>` to skip this.
```

### Option 2: prepare it with the CLI (recommended)

Do this once per video, on your own machine, from your project folder.

**1. Make ffmpeg available.** Pick one:

```bash
npm i -D ffmpeg-static        # easiest: puts an ffmpeg binary in node_modules
```

or install ffmpeg system-wide (`winget install Gyan.FFmpeg` on Windows,
`brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian/Ubuntu),
or point `FFMPEG_PATH` at an ffmpeg binary.

**2. Encode the video:**

```bash
npx vidscroll encode public/videos/hero.mp4
# writes public/videos/hero.scroll.mp4
```

**3. Use the new file:**

```tsx
<ScrollVideo src="/videos/hero.scroll.mp4" />
```

Commit or upload `hero.scroll.mp4` wherever your site serves files from. The
original isn't needed by the site. Since the prepared file already has
keyframes close together, vidscroll uses it as-is: no re-encoding, no wait.

#### CLI reference

```bash
npx vidscroll encode <input> [output] [options]
npx vidscroll --help
```

| Option | Default | Meaning |
| --- | --- | --- |
| `[output]` | `<input>.scroll.mp4` | Where to write the prepared video |
| `--resolution <px>` | 720 | Cap on the shorter side (720 = 720p, landscape or portrait). Never upscales |
| `--gop <frames>` | 10 | Frames between keyframes; lower seeks faster, file gets bigger |
| `--crf <n>` | 22 | Quality; lower is better and bigger (18–28 is sensible) |
| `--fps <n>` | source | Frame-rate cap |

Examples:

```bash
npx vidscroll encode hero.mp4 --resolution 1080 --crf 20   # sharper, bigger
npx vidscroll encode long-tour.mp4 --fps 24                 # smaller file
```

Audio is removed (it never plays while scrubbing). The output is usually larger
than the input, because frequent keyframes cost space: a 4.7 MB 60 s clip
became 11.9 MB at the defaults. 1080p looks sharper but seeks take slightly
longer than one screen refresh (25–37 ms measured vs 19 ms at 720p), so it
scrubs a little less smoothly.

## How it works

Browsers can only start decoding a video at a keyframe. Jumping to a frame
means decoding every frame from the previous keyframe up to it, so a seek's
cost grows with the distance between keyframes.

Measured in Chrome on a 1080p clip:

| Keyframe spacing | Typical seek | Worst seek |
| --- | --- | --- |
| 250 frames (a common export default) | 287 ms | 535 ms |
| 10 frames (`vidscroll encode`) | 19 ms | 21 ms |

At 287 ms per seek, a video can show only 3–4 new frames per second while
you scroll. At 19 ms it keeps up with the display.

When `<ScrollVideo>` loads a video it:

1. Downloads the file and reads its keyframe layout (no decoding).
2. Uses it as-is if keyframes are at most 0.5 s apart.
3. Otherwise re-encodes it in the browser (720p, a keyframe every 0.25 s, no
   audio) with WebCodecs, and saves the result in Cache Storage. The cached
   copy is reused until the source file changes. While it re-encodes, the
   original stays on screen. Scrolling forward plays it, with the playback
   speed following the scroll speed (up to 16x). Scrolling back, or jumping
   further than playback can catch up, seeks instead. While scrolling
   continues, each seek is followed by a pause as long as the seek took, so
   the decoder stays free for the re-encode. When the re-encoded copy is ready,
   it's loaded into a second `<video>` underneath, seeked to the current frame,
   and swapped in. If the browser refuses to play the video (as iOS does in
   Low Power Mode), it seeks for both directions instead.
4. In browsers without WebCodecs, or if re-encoding fails, it uses the original
   and logs a warning.

Once a video scrubs smoothly, scrolling seeks it frame by frame. On Android,
scrolling forward plays it at the scroll's speed instead, because Android
shows at most about 30 sought frames per second while forward playback keeps
up with the screen (measured on a 90 Hz phone: 30 vs 77 frames per second at
3x speed).

Re-encoding uses the `mediabunny` dependency, which is downloaded only when a
video actually needs it (about 180 KB gzipped).

## Which URLs work

| `src` | Result |
| --- | --- |
| Video file on your site (`/hero.mp4`) | Works fully |
| Video file on another domain **with CORS** (`Access-Control-Allow-Origin`) | Works fully |
| Video file on another domain **without CORS** | Plays, but can't be read or re-encoded; scrubs smoothly only if pre-encoded. Logs a warning |
| YouTube / Vimeo / TikTok / Instagram page links | Error: these are web pages, not files. Their streams are signed, expire, and can't be read by other sites |
| HLS / DASH streams (`.m3u8`, `.mpd`) | Error: built for linear playback, can't be scrubbed |
| A path that doesn't exist | Error, including when your host answers with `index.html` |

To use a video that's on YouTube, download your original (YouTube Studio lets
owners download their uploads) and host the file yourself.

## `<ScrollVideo>` props

| Prop | Default | Description |
| --- | --- | --- |
| `src` | required | Video file URL |
| `length` | `"auto"` | How much scrolling plays the whole video: `"400vh"`, `"2000px"` or a number of px. `"auto"` is 40vh per second of video |
| `optimize` | `true` | Re-encode slow-to-seek videos in the browser. `false` to disable, or an object: `maxKeyframeGap` (s, default 0.5), `maxResolution` (short side, default 720), `maxFps` (default 30; 15 for videos over 2 min), `cache` (default true), `wait` (default false: scrub the original while re-encoding; true: show the loader until the re-encoded copy is ready) |
| `smoothScroll` | `false` | Eased mouse-wheel scrolling for the page. `true` or `{ tau, wheelMultiplier }` |
| `fit` | `"cover"` | `"cover"` fills the stage and crops; `"contain"` shows the whole frame |
| `easing` | linear | `(t) => t` curve from scroll progress to video time; see `easing` export |
| `poster` | first frame | Shown while loading. By default the video's first frame is fetched and shown behind the loader; pass an image URL instead, or `false` for none |
| `loader` | built-in | `false`, a React node, or `(state, builtIn) => node` with state `{ phase, progress, background, error }` and `builtIn` the default loader for that state. The default is a translucent overlay, and a small corner badge while a raw video is scrollable but still re-encoding. See [Loader states](#loader-states) |
| `onLoad` | | `({ source, probe }) => void`, called once the final video is known. `source` is `"original"`, `"optimized"`, `"cache"` or `"stream"` |
| `onError` | | `(error) => void`. Errors are `VidscrollError` with a `code` |
| `fullPreload` | `true` | `false` streams the URL directly and skips optimization |
| `className`, `style` | | Applied to the outer block |
| `fps` | 30 | Frame rate used for frame-based section ranges |
| `smoothingTauMs` | 100 (35 with `smoothScroll`) | How tightly the video follows the scroll position. After fast scrolling (over 2x the video's speed) the follow loosens to up to 150 ms, so the video and sections glide to a stop instead of jumping. Jumps of more than 1 s of video in one frame (scrollbar drags, `behavior: "instant"`) snap straight there |
| `warmup` | `true` | Touch the whole timeline once while loading. `false` or a step count |
| `debug` / `onDebug` | | Log engine internals |

Set `length` explicitly when there's content below the video: with
`"auto"`, the block only knows its height once the video's duration has
loaded, so content below it moves down at that point.

### Loader states

```tsx
<ScrollVideo
  src="/hero.mp4"
  loader={({ phase, progress, background, error }) =>
    error ? <p>{error.message}</p>
    : background ? <small>Smoothing {Math.round(progress * 100)}%</small>
    : <Spinner label={phase} value={progress} />
  }
/>
```

`phase` is `"download"`, `"optimize"`, `"preparing"`, or `"error"`.

`background` is `true` while a raw video is already scrubbable and the
re-encode carries on behind it. The loader element then sits in the bottom-right
corner (`[data-vidscroll-loader][data-background]`) instead of covering the
video, so return something small, or `null` to show nothing. A loader passed
as a plain node rather than a function is shown only while the video is
covered.

With `optimize={{ wait: true }}` there is no background phase: the full loader
stays until the smooth copy is ready.

#### Customizing the corner badge

| You want | Do this |
| --- | --- |
| No badge, built-in loader otherwise | `[data-vidscroll-loader][data-background] { display: none; }` in your CSS |
| The badge somewhere else, or styled differently | Style `[data-vidscroll-loader][data-background]`, e.g. `inset: 16px 16px auto auto` for the top-right corner |
| Your own badge, built-in loader otherwise | `loader={(s, builtIn) => (s.background ? <MyBadge progress={s.progress} /> : builtIn)}` |
| Your own loader, built-in badge | `loader={(s, builtIn) => (s.background ? builtIn : <MyLoader state={s} />)}` |
| Your own loader, no badge | `loader={<MyLoader />}` (a plain node only shows while the video is covered) |
| Nothing at all | `loader={false}` |

The default rules have zero specificity, so plain CSS like the above wins
without `!important`.

## `<Section>` props

| Prop | Description |
| --- | --- |
| `start`, `end` | Active range as scroll progress, 0–1 |
| `fromTime`, `toTime` | Range in seconds of video (alternative to start/end) |
| `fromFrame`, `toFrame` | Range in frames |
| `className`, `activeClassName`, `inactiveClassName`, `style` | Styling; the class props toggle with the active state |
| `as` | Element type (default `div`) |

### Styling

vidscroll ships no stylesheet to import. It adds a few default rules, all
wrapped in `:where()` so they have zero specificity: any CSS you write wins,
without `!important`. The defaults:

- A section covers the video, centres its content, and fades in over 0.4 s
  while active.
- Elements expose their state as attributes you can target:

| Selector | Element |
| --- | --- |
| `[data-vidscroll]` | Outer block (its height is the scroll length) |
| `[data-vidscroll-stage]` | Pinned viewport-sized stage (`position: sticky`) |
| `[data-vidscroll-media]` | The `<video>` |
| `[data-vidscroll-section]` | Each section; `[data-active]` while active |
| `[data-vidscroll-loader]` | Loading overlay; `[data-phase]` holds the phase, `[data-background]` marks the corner badge |

For example, a slower fade that also slides up:

```css
.caption {
  transform: translateY(1rem);
  transition: opacity 1s, transform 1s, visibility 0s 1s;
}
.caption[data-active] {
  transform: none;
  transition: opacity 1s, transform 1s;
}
```

### Scroll-driven styles with `--progress`

Each `<Section>` sets a `--progress` CSS variable on its element: `0` before
its range, `1` after it, and linear in between. It's written straight to the
DOM, so animating with it costs no React renders. Plain CSS can then fade,
move or blur anything inside the section as you scroll:

```css
.caption {
  opacity: calc(1 - var(--progress));
  transform: translateY(calc(var(--progress) * -40px));
}
```

See [Recipes](#recipes) for staggered lines, reveals and more.

### Whole-video progress: `--video-progress`

The outer block carries `--video-progress` (0–1 across the whole video), so
any element inside a `ScrollVideo` can follow it without a `Section`:

```css
.progress-bar {
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: white;
  transform-origin: left;
  transform: scaleX(var(--video-progress));
}
```

Inside a section, `--progress` is the section's own progress and
`--video-progress` is still available.

### From JavaScript

These hooks work in any component inside a `ScrollVideo`:

```tsx
import { useRef } from "react";
import { useScrollVideoState, useScrollVideoUpdate } from "vidscroll";

function Timecode() {
  const { time, ready } = useScrollVideoState();
  return <span>{ready ? time.toFixed(1) : "–"}s</span>;
}

function Dial() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVideoUpdate(({ linearProgress }) => {
    ref.current!.style.rotate = `${linearProgress * 360}deg`;
  });
  return <div ref={ref} />;
}
```

- `useScrollVideoState()` returns `{ ready, progress, time, frame,
  activeSections }` and re-renders when they change, which is every frame
  while scrolling. Fine for small components.
- `useScrollVideoUpdate(callback)` calls back on every frame with the engine
  state (`linearProgress`, `time`, `frameIndex`, `activeSections`) without
  re-rendering. Use it with refs for anything per-frame.

For actions, `useScrollVideo().api` gives access to the engine:

- `api.scrollToTime(seconds)` and `api.scrollToProgress(p)` scroll the page
  to a point in the video, smoothly by default so the video scrubs through
  everything on the way. Pass `{ behavior: "instant" }` to jump. Useful for
  chapter navigation:

```tsx
function Chapters() {
  const { api } = useScrollVideo();
  return <button onClick={() => api?.scrollToTime(12)}>Open water</button>;
}
```

- `api.getSectionProgress(id)` returns the same 0–1 value as `--progress`.

## Recipes

Each of these is taken from a demo and needs nothing beyond the library and
your own CSS.

### Text that fades in and out across its range

```tsx
<Section fromTime={9.6} toTime={12} className="caption">
  <p>She closes her eyes.</p>
</Section>
```

```css
.caption p {
  opacity: clamp(0, min(var(--progress) / 0.15, (1 - var(--progress)) / 0.15), 1);
}
```

Fades in over the first 15% of the range, out over the last 15%.

### Lines that rise in, then dissolve one by one

Give each line its index (`--i`) and the stanza its line count (`--n`):

```tsx
const lines = ["Every evening, the same fence,", "the same warm wood beneath the paws.", "The cat stays."];

<Section start={0.1} end={0.4}>
  <div className="stanza" style={{ "--n": lines.length } as React.CSSProperties}>
    {lines.map((line, i) => (
      <p key={i} style={{ "--i": i } as React.CSSProperties}>{line}</p>
    ))}
  </div>
</Section>
```

```css
.stanza p {
  --enter: clamp(0, (var(--progress) / 0.32 * (var(--n) + 1) - var(--i)) / 2, 1);
  --exit: clamp(0, ((var(--progress) - 0.56) / 0.38 * (var(--n) + 1) - var(--i)) / 2, 1);
  opacity: calc(var(--enter) - var(--exit));
  transform: translateY(calc((1 - var(--enter)) * 1.1em - var(--exit) * 1.3em));
  filter: blur(calc(var(--exit) * 6px));
}
```

Lines enter during the first 32% of the section, the stanza holds until 56%,
then lines dissolve upward in the same order. Each line's animation overlaps
the next one's by half.

### A circular reveal

```tsx
<Section start={0} end={0.07} className="iris">
  <div className="iris__mask" />
  <h1>The Commute</h1>
</Section>
```

```css
.iris__mask {
  position: absolute;
  inset: 0;
  --r: calc(var(--progress) * 80vmax);
  background: radial-gradient(circle, transparent var(--r), #000 var(--r));
}
.iris h1 {
  position: relative;
  opacity: calc(1 - var(--progress) * 2);
}
```

### A progress bar

```tsx
<ScrollVideo src="/hero.mp4">
  <div className="progress-bar" />
</ScrollVideo>
```

```css
.progress-bar {
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: white;
  transform-origin: left;
  transform: scaleX(var(--video-progress));
}
```

### Chapters you can jump between

```tsx
const CHAPTERS = [
  { title: "Doors", at: 0 },
  { title: "Open water", at: 12.2 },
  { title: "Away", at: 25.1 },
];

function ChapterNav() {
  const { api } = useScrollVideo();
  const [current, setCurrent] = useState(0);
  useScrollVideoUpdate(({ time }) => {
    let index = 0;
    CHAPTERS.forEach((c, i) => {
      if (time >= c.at) index = i;
    });
    setCurrent(index);
  });
  return (
    <nav style={{ pointerEvents: "auto" }}>
      {CHAPTERS.map((c, i) => (
        <button key={c.title} aria-current={i === current} onClick={() => api?.scrollToTime(c.at)}>
          {c.title}
        </button>
      ))}
    </nav>
  );
}
```

`setCurrent` only re-renders when the chapter changes. The overlay ignores
pointer events by default, so interactive elements need `pointer-events: auto`.

### Live numbers driven by the scroll

```tsx
function Clock() {
  const ref = useRef<HTMLParagraphElement>(null);
  useScrollVideoUpdate(({ linearProgress }) => {
    const minutes = 18 * 60 + 42 + linearProgress * 49;
    const text = `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
    if (ref.current && ref.current.textContent !== text) ref.current.textContent = text;
  });
  return <p ref={ref}>18:42</p>;
}
```

Writing to the DOM through a ref keeps it at display rate without
re-rendering React.

## Image sequences

If you already have frames as images, `<ScrollFrames>` draws them to a canvas
with no video decoding:

```tsx
<ScrollFrames urls="/frames/frame_{i4}.webp" count={240} />
```

## TypeScript

Everything is typed. Besides the component props (`ScrollVideoProps`,
`SectionProps`, `ScrollFramesProps`), these types are exported:

| Type | What it is |
| --- | --- |
| `ScrollVideoApi` | `useScrollVideo().api`: `on`, `off`, `getState`, `isReady`, `scrollToTime`, `scrollToProgress`, `getSectionProgress` |
| `ScrollVideoSnapshot` | Engine state passed to `useScrollVideoUpdate` and `update` events |
| `ScrollVideoState` | Return value of `useScrollVideoState` |
| `LoaderState` | Argument of a `loader` function |
| `VidscrollError`, `VidscrollErrorCode` | Errors passed to `onError` (`unsupported-url`, `http-error`, `not-a-video`, `unplayable`) |
| `OptimizeOptions`, `SmoothScrollOptions`, `ScrollToOptions` | Option objects |

## Guidance

- **Length:** best under about 2 minutes. Longer videos make very long pages
  and slow first loads; vidscroll warns above 2 minutes.
- **Size:** every visitor downloads the whole file before scrolling unlocks.
  vidscroll warns above 100 MB.
- **Audio** is never played and is dropped when re-encoding.

## Browser support

Scrubbing works in all modern browsers. In-browser re-encoding needs
WebCodecs: Chrome/Edge 94+, Safari 16.4+, Firefox 130+. Elsewhere, pre-encode
with the CLI.

The automated tests run the demos in Chrome, Firefox and WebKit. The WebKit
they use (Playwright's Windows build) has no WebCodecs, so there it only runs
pre-encoded videos, plus a check that an unplayable video shows an error
instead of loading forever. On real devices it has been measured on one
Android phone (Chromium-based Brave), including in-browser re-encoding. Real
Safari and iOS haven't been tested yet.

If a browser can't play the downloaded copy of a video, vidscroll streams
the original URL instead. If it can't play or seek that either, the loader
shows an error (and `onError` fires) rather than waiting forever.

## Demos

Live at https://vidscroll.ze-ro.workers.dev, or run them locally with
`npm run dev` (http://localhost:5173):

| Demo | Shows |
| --- | --- |
| A Small Vigil | Line-by-line poetry styled only with `--progress` CSS |
| The Commute | Film framing, captions timed in seconds, chapter jumps with `scrollToTime`, a pre-encoded video |
| Evening Almanac | Live numbers and an SVG driven from the `update` event, no re-renders |
| Basics | The smallest setup |

## Development

```bash
npm install
npm run dev         # demos (demo/) at http://localhost:5173
npm run build       # library → dist/
npm run typecheck
npm run lint
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright) in Chrome, Firefox and WebKit
```

The demo imports the library from `src/` directly. Browser tests need Google
Chrome installed plus `npx playwright install firefox webkit`; they build the
demo and serve it on port 4173.

To measure playback on a device, add `?stats` to a demo URL (for example
`/?stats#/sunset`). A panel then shows frames shown per second while
scrolling, jump size between frames, seek time and load times, with a
copyable report. `#/lab` runs scripted scrubs that compare seeking, playing
and WebCodecs-to-canvas on the same device. Open both over HTTPS: browsers
turn off WebCodecs and Cache Storage on plain-HTTP LAN addresses.

## Credits

The train animation used in the demos is
["30 second animation assignment"](https://www.youtube.com/watch?v=_Td7JjCTfyc)
by [roenais](https://www.youtube.com/@roenais).

## License

MIT
