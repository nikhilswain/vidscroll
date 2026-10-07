import { ScrollVideo } from "vidscroll";
import type { EasingName } from "vidscroll";
import { asset } from "./asset";

export interface OptionsProps {
  easing: EasingName;
  length: string;
  fit: "cover" | "contain";
  smoothScroll: boolean;
}

export default function Example({ easing, length, fit, smoothScroll }: OptionsProps) {
  return <ScrollVideo src={asset("train.mp4")} length={length} easing={easing} fit={fit} smoothScroll={smoothScroll} />;
}
