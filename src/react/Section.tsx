import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import type { SectionDescriptor } from "../core/types";
import { useEngine } from "./context";

export interface SectionProps extends Omit<SectionDescriptor, "id"> {
  id?: string;
  as?: ElementType;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Section({
  id,
  as: Element = "div",
  className,
  activeClassName,
  inactiveClassName,
  style,
  children,
  ...range
}: SectionProps) {
  const autoId = useId();
  const sectionId = id || autoId;
  const api = useEngine();
  const [active, setActive] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!api) return;
    const onEnter = (p: { id: string }) => p.id === sectionId && setActive(true);
    const onExit = (p: { id: string }) => p.id === sectionId && setActive(false);
    api.on("sectionEnter", onEnter);
    api.on("sectionExit", onExit);
    return () => {
      api.off("sectionEnter", onEnter);
      api.off("sectionExit", onExit);
    };
  }, [api, sectionId]);

  const rangeRef = useRef(range);
  rangeRef.current = range;
  const rangeKey = JSON.stringify(range);
  useEffect(() => {
    if (!api) return;
    api.registerSection({ id: sectionId, ...rangeRef.current });
    setActive(api.getState().activeSections.includes(sectionId));
    return () => api.unregisterSection(sectionId);
  }, [api, sectionId, rangeKey]);

  useEffect(() => {
    const el = elementRef.current;
    if (!api || !el) return;
    let last = -1;
    const apply = () => {
      const p = api.getSectionProgress(sectionId);
      if (Math.abs(p - last) < 0.0001) return;
      last = p;
      el.style.setProperty("--progress", p.toFixed(4));
    };
    apply();
    api.on("update", apply);
    return () => api.off("update", apply);
  }, [api, sectionId]);

  const classes = [className, active ? activeClassName : inactiveClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <Element
      ref={elementRef}
      data-vidscroll-section={sectionId}
      data-active={active ? "true" : undefined}
      className={classes || undefined}
      style={style}
    >
      {children}
    </Element>
  );
}
