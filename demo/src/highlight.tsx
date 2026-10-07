import type { ReactNode } from "react";

const TOKENS =
  /(?<string>"[^"]*")|(?<keyword>\b(?:import|from|export|const|return)\b)|(?<tag><\/?[A-Za-z][\w.]*|\/?>)|(?<attr>\b[a-zA-Z][\w-]*(?==))|(?<number>\b\d+(?:\.\d+)?\b)|(?<punct>[{}();,=])/g;

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKENS)) {
    const index = match.index ?? 0;
    if (index > last) out.push(code.slice(last, index));
    const kind = Object.entries(match.groups ?? {}).find(([, value]) => value != null)?.[0];
    out.push(
      <span key={index} className={`tok-${kind}`}>
        {match[0]}
      </span>
    );
    last = index + match[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}
