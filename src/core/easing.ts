export const easing = {
  none: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export type EasingName = keyof typeof easing;

export function invertEasing(curve: (t: number) => number, value: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (curve(mid) < value) lo = mid;
    else hi = mid;
  }
  return hi;
}

const TAIL_FROM = 0.99;

export function withTail(curve: (t: number) => number) {
  const atTail = curve(TAIL_FROM);
  return (p: number) => {
    const value = p <= TAIL_FROM ? curve(p) : atTail + (1 - atTail) * ((p - TAIL_FROM) / (1 - TAIL_FROM));
    return Math.min(Math.max(value, 0), 1);
  };
}
