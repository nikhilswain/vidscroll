import { readFileSync } from "node:fs";

export function readBytes(path: string): Uint8Array<ArrayBuffer> {
  const buffer = readFileSync(path);
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

export const FRAGMENTED_LONG_GOP = "demo/public/catAnime.mp4";
export const PREPARED = "demo/public/commute.mp4";
