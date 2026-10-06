import { describe, expect, it } from "vitest";
import { easing, invertEasing, withTail } from "../../src/core/easing";

const names = Object.keys(easing) as (keyof typeof easing)[];

describe("easing presets", () => {
  it.each(names)("%s runs from 0 to 1 without going backwards", (name) => {
    const curve = easing[name];
    expect(curve(0)).toBeCloseTo(0, 9);
    expect(curve(1)).toBeCloseTo(1, 9);
    for (let i = 1; i <= 100; i++) {
      expect(curve(i / 100)).toBeGreaterThanOrEqual(curve((i - 1) / 100) - 1e-12);
    }
  });

  it.each(names)("%s can be inverted", (name) => {
    const curve = easing[name];
    for (const value of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      expect(curve(invertEasing(curve, value))).toBeCloseTo(value, 6);
    }
  });
});

describe("withTail", () => {
  it("never goes backwards and ends at 1 for every preset", () => {
    for (const [name, curve] of Object.entries(easing)) {
      const shaped = withTail(curve);
      let previous = -1;
      for (let i = 0; i <= 2000; i++) {
        const value = shaped(i / 2000);
        expect(value, `${name} at ${i / 2000}`).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
      expect(shaped(1), name).toBe(1);
      expect(shaped(0.5), name).toBeCloseTo(curve(0.5), 10);
    }
  });
});
