# Contributing

```bash
npm install
npm run dev         # demos (demo/) at http://localhost:5173
npm run site:dev    # docs site and demos at http://localhost:4321/vidscroll/
npm run build       # library → dist/
npm run typecheck
npm run lint
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright) in Chrome, Firefox and WebKit
npm run site:build  # docs site and demos → dist-site/
```

The demos and the docs site import the library from `src/` directly. Browser
tests need Google Chrome installed plus `npx playwright install firefox webkit`;
they build the demos and serve them on port 4173.

To measure playback on a device, add `?stats` to a demo URL (for example
`/?stats#/sunset`). A panel then shows frames shown per second while
scrolling, jump size between frames, seek time and load times, with a
copyable report. `#/lab` runs scripted scrubs that compare seeking, playing
and WebCodecs-to-canvas on the same device. Open both over HTTPS: browsers
turn off WebCodecs and Cache Storage on plain-HTTP LAN addresses.
