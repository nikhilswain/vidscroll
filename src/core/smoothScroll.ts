export interface SmoothScrollOptions {
  tau?: number;
  wheelMultiplier?: number;
}

export interface SmoothScrollInstance {
  destroy(): void;
}

export function createSmoothScroll(
  options: SmoothScrollOptions = {}
): SmoothScrollInstance {
  const tau = options.tau ?? 85;
  const wheelMultiplier = options.wheelMultiplier ?? 1;

  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { destroy() {} };
  }

  let target = window.scrollY;
  let current = target;
  let expectedY = target;
  let rafId = 0;
  let animating = false;
  let lastTime = 0;
  let destroyed = false;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function stop() {
    animating = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function start() {
    if (destroyed || animating) return;
    animating = true;
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function loop(now: number) {
    if (destroyed) return;
    const dt = lastTime > 0 ? Math.min(now - lastTime, 100) : 16.7;
    lastTime = now;
    const alpha = 1 - Math.exp(-dt / tau);
    current += (target - current) * alpha;
    if (Math.abs(target - current) < 0.5) current = target;
    expectedY = current;
    window.scrollTo(0, current);
    if (current === target) {
      stop();
      lastTime = 0;
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function onWheel(e: WheelEvent) {
    if (destroyed || e.ctrlKey || e.deltaY === 0) return;
    e.preventDefault();
    const unit =
      e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? window.innerHeight : 1;
    if (!animating && Math.abs(window.scrollY - target) > 1) {
      target = current = window.scrollY;
    }
    target = Math.min(
      Math.max(target + e.deltaY * unit * wheelMultiplier, 0),
      maxScroll()
    );
    start();
  }

  function onScroll() {
    if (destroyed) return;
    if (!animating) {
      target = current = window.scrollY;
      return;
    }
    if (Math.abs(window.scrollY - expectedY) > 1.5) {
      target = current = expectedY = window.scrollY;
      stop();
    }
  }

  function onResize() {
    target = Math.min(target, maxScroll());
  }

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  return {
    destroy() {
      destroyed = true;
      stop();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}
