# vidscroll

Scroll-scrubbed video for React. Scrolling moves a video frame by frame, with
text sections that fade in and out along the way.

- **Smooth on any video file.** Most exported videos have keyframes several
  seconds apart, which makes every seek slow. vidscroll detects that and
  re-encodes the video in the browser (WebCodecs) on the first visit, then
  caches the result. Later visits load instantly.
- **Or skip the wait:** `npx vidscroll encode hero.mp4` prepares the file ahead
  of time.
- Clear errors for things that can't work, like YouTube links or a wrong path.

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
| First visit | Wait while the browser re-encodes it (about 10 s for a 60 s 1080p clip on a desktop; longer on phones) | Just the download |
| Later visits | Instant (cached) | Instant |
| Best for | Trying things out, user-uploaded videos | Production sites |

### Option 1: use the raw video

Pass its URL. That's all:

```tsx
<ScrollVideo src="/videos/hero.mp4" />
```

If the video isn't encoded for scrubbing (most exports aren't), vidscroll
re-encodes it in the browser behind a progress bar and caches the result. The
browser console shows a hint like this. It's a suggestion, not an error:

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
   copy is reused until the source file changes.
4. In browsers without WebCodecs, or if re-encoding fails, it uses the original
   and logs a warning.

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
| `optimize` | `true` | Re-encode slow-to-seek videos in the browser. `false` to disable, or an object: `maxKeyframeGap` (s, default 0.5), `maxResolution` (short side, default 720), `maxFps` (default 30; 15 for videos over 2 min), `cache` (default true) |
| `smoothScroll` | `false` | Eased mouse-wheel scrolling for the page. `true` or `{ tau, wheelMultiplier }` |
| `fit` | `"cover"` | `"cover"` fills the stage and crops; `"contain"` shows the whole frame |
| `easing` | linear | `(t) => t` curve from scroll progress to video time; see `easing` export |
| `loader` | built-in | `false`, a React node, or `(state) => node` with `{ phase, progress, error }` |
| `onLoad` | | `({ source, probe }) => void`. `source` is `"original"`, `"optimized"`, `"cache"` or `"stream"` |
| `onError` | | `(error) => void`. Errors are `VidscrollError` with a `code` |
| `fullPreload` | `true` | `false` streams the URL directly and skips optimization |
| `className`, `style` | | Applied to the outer block |
| `fps` | 30 | Frame rate used for frame-based section ranges |
| `smoothingTauMs` | 100 (35 with `smoothScroll`) | How tightly the video follows the scroll position |
| `warmup` | `true` | Touch the whole timeline once while loading. `false` or a step count |
| `debug` / `onDebug` | | Log engine internals |

Set `length` explicitly when there's content below the video: with
`"auto"`, the block only knows its height once the video's duration has
loaded, so content below it moves down at that point.

### Loader states

```tsx
<ScrollVideo
  src="/hero.mp4"
  loader={({ phase, progress, error }) =>
    error ? <p>{error.message}</p> : <Spinner label={phase} value={progress} />
  }
/>
```

`phase` is `"download"`, `"optimize"`, `"preparing"`, or `"error"`.

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
| `[data-vidscroll-loader]` | Loading overlay |

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

To reveal lines one after another, give each line its index and the line
count, and let CSS stagger them:

```tsx
<Section start={0.1} end={0.4}>
  <div className="stanza" style={{ "--n": lines.length } as React.CSSProperties}>
    {lines.map((line, i) => (
      <p key={i} style={{ "--i": i } as React.CSSProperties}>{line}</p>
    ))}
  </div>
</Section>
```

```css
/* Each line fades in over its own slice of the first 40% of the section. */
.stanza p {
  --in: clamp(0, var(--progress) / 0.4 * var(--n) - var(--i), 1);
  opacity: var(--in);
  transform: translateY(calc((1 - var(--in)) * 1em));
}
```

The "A Small Vigil" demo (`demo/src/demos/sunset`) uses this to make lines
rise in and dissolve one by one.

### From JavaScript

Inside a `ScrollVideo`, `useScrollVideo().api` gives access to the engine:

- `api.on("update", (state) => …)` fires on every frame the video moves, with
  `state.linearProgress` (0–1), `frameIndex` and `activeSections`.
- `api.getSectionProgress(id)` returns the same 0–1 value as `--progress`.
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

## Image sequences

If you already have frames as images, `<ScrollFrames>` draws them to a canvas
with no video decoding:

```tsx
<ScrollFrames urls="/frames/frame_{i4}.webp" count={240} />
```

## Lower-level API

- `loadScrollVideo(src, { optimize, onProgress, signal })`: the load and
  optimize pipeline, without React.
- `probeMp4(arrayBuffer)`: keyframe layout of an MP4/MOV file.
- `createEngine(options)`: the scroll-to-video engine.

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

## Demos

`npm run dev` serves them at http://localhost:5173:

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
```

The demo imports the library from `src/` directly.

## License

MIT
