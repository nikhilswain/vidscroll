import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function open(page: Page, slug: string) {
  await page.goto(`/#/${slug}`);
  await expect(page.locator("[data-vidscroll]").first()).toBeAttached();
  await expect(page.locator("[data-vidscroll-loader]")).toHaveCount(0, { timeout: 90_000 });
}

async function scrollBlock(page: Page, progress: number, index = 0) {
  await page.evaluate(
    ([p, i]) => {
      const block = document.querySelectorAll<HTMLElement>("[data-vidscroll]")[i];
      const stage = block.querySelector<HTMLElement>("[data-vidscroll-stage]")!;
      const top = block.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + p * (block.offsetHeight - stage.offsetHeight), behavior: "instant" });
    },
    [progress, index] as const
  );
}

async function settledTime(page: Page, index = 0) {
  return page.evaluate(async (i) => {
    const video = document.querySelectorAll<HTMLVideoElement>("[data-vidscroll] video")[i];
    let last = -1;
    let stableSince = performance.now();
    const start = performance.now();
    while (performance.now() - start < 15_000) {
      await new Promise((r) => setTimeout(r, 50));
      if (video.currentTime !== last) {
        last = video.currentTime;
        stableSince = performance.now();
      } else if (!video.seeking && performance.now() - stableSince > 600) {
        break;
      }
    }
    return video.currentTime;
  }, index);
}

const stageTop = (page: Page, index = 0) =>
  page.evaluate((i) => {
    const block = document.querySelectorAll("[data-vidscroll]")[i];
    return block.querySelector("[data-vidscroll-stage]")!.getBoundingClientRect().top;
  }, index);

const activeSections = (page: Page) =>
  page.locator("[data-vidscroll-section][data-active]").allTextContents();

const RAW_VIDEO_NEEDS_WEBCODECS =
  "the cat demos use a raw fragmented MP4; Playwright's Windows WebKit has no WebCodecs to re-encode it and can't seek it";

test("a scroll video pins inside a page and plays only while scrolled through", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", RAW_VIDEO_NEEDS_WEBCODECS);
  await open(page, "basics");

  await scrollBlock(page, -0.1);
  expect(await stageTop(page)).toBeGreaterThan(0);

  await scrollBlock(page, 0.5);
  expect(await stageTop(page)).toBe(0);
  expect(await settledTime(page)).toBeCloseTo(30, 0);
  expect(await activeSections(page)).toContain("Middle");

  await scrollBlock(page, 1);
  expect(await settledTime(page)).toBeGreaterThan(59.5);

  await scrollBlock(page, 1, 1);
  expect(await stageTop(page)).toBeLessThan(0);
  expect(await settledTime(page, 1)).toBeGreaterThan(29.5);
  expect(await settledTime(page, 0)).toBeGreaterThan(59.5);
});

test("poem lines reveal and dissolve one by one with --progress", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", RAW_VIDEO_NEEDS_WEBCODECS);
  await open(page, "sunset");
  await expect(page.locator('[data-vidscroll-section="title"][data-active]')).toBeAttached();

  await scrollBlock(page, 0.335);
  await settledTime(page);
  const left = await page
    .locator('[data-vidscroll-section="left"] .stanza__line')
    .evaluateAll((lines) => lines.map((l) => Number(getComputedStyle(l).opacity)));
  expect(left[0]).toBeLessThan(0.1);
  expect(left[2]).toBeGreaterThan(0.3);
  expect(left[2]).toBeLessThan(0.8);
  expect(left[4]).toBe(1);

  await scrollBlock(page, 1);
  await settledTime(page);
  const coda = await page
    .locator('[data-vidscroll-section="coda"] .stanza__line')
    .evaluateAll((lines) => lines.map((l) => Number(getComputedStyle(l).opacity)));
  expect(coda).toEqual([1, 1]);
});

test("chapter buttons jump to the right scene", async ({ page }) => {
  await open(page, "commute");
  await page.getByRole("button", { name: /Setting sail/ }).click();
  await expect(page.locator(".chapters button[aria-current] .chapters__title")).toHaveText("Setting sail");
  expect(await settledTime(page)).toBeCloseTo(18.55, 1);
  await expect(page.locator(".caption[data-active]")).toContainText("ropes");
});

test("live readings follow the scroll position", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", RAW_VIDEO_NEEDS_WEBCODECS);
  await open(page, "almanac");
  await scrollBlock(page, 0.55);
  await settledTime(page);
  await expect(page.locator(".almanac__clock")).toHaveText("19:08");
});

test("a video the browser can't seek shows an error instead of loading forever", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "only this WebKit build fails to seek the raw demo video");
  await page.goto("/#/almanac");
  await expect(page.locator("[data-vidscroll-loader]")).toContainText("can't scrub", { timeout: 60_000 });
  await expect(page.locator("[data-vidscroll-loader]")).toContainText("npx vidscroll encode");
});
