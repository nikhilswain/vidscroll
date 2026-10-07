# Contributing

```bash
npm install
npm run dev         # demos (demo/) at http://localhost:5173
npm run site:dev    # docs site and demos at http://localhost:4321/
npm run build       # library → dist/
npm run typecheck
npm run lint
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright) in Chrome, Firefox and WebKit
npm run site:build  # docs site and demos → dist-site/
npm run site:check  # check every internal link and #anchor in dist-site/
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

## Releasing

1. Add a section to `CHANGELOG.md`, newest first, headed `## x.y.z (YYYY-MM-DD)`.
   Commit it. The docs changelog page renders this file.
2. Check everything passes:

   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```

3. Bump the version and commit only that change:

   ```bash
   npm version x.y.z --no-git-tag-version
   git commit -am "Release x.y.z"
   git tag -a vx.y.z -m "Release x.y.z"
   git push origin main vx.y.z
   ```

   Pushing the tag deploys the docs site (`.github/workflows/site.yml`).
4. Publish to npm from your own terminal (it asks for two-factor
   confirmation in the browser):

   ```bash
   npm publish
   ```

5. Create the GitHub release with that version's changelog section as notes:

   ```bash
   gh release create vx.y.z --verify-tag --title vx.y.z --notes-file notes.md
   ```

To redeploy the docs site without a release, run the Site workflow from the
Actions tab ("Run workflow").
