import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import "../../src/element";

const DOCS = "site/src/pages/docs";

const page = (path: string) => readFileSync(`${DOCS}/${path}.mdx`, "utf8");

const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mentions = (text: string, name: string) =>
  new RegExp(`(\`|<code>|name: ")(&lt;)?${escape(name)}(\\(|\`|</code>|"|&gt;)`).test(text) ||
  new RegExp(`[\`>]${escape(name)}[=(]`).test(text) ||
  new RegExp(`name: "([^"]*, )?${escape(name)}(, [^"]*)?"`).test(text);

const undocumented = (names: string[], text: string) => names.filter((name) => !mentions(text, name));

let program: ts.Program;
let checker: ts.TypeChecker;

const moduleExports = (file: string) => {
  const source = program.getSourceFile(file)!;
  return checker.getExportsOfModule(checker.getSymbolAtLocation(source)!).map((symbol) => symbol.name);
};

const exportedSymbol = (file: string, name: string) => {
  const source = program.getSourceFile(file)!;
  const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(source)!).find((s) => s.name === name)!;
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
};

const propertiesOf = (file: string, name: string) =>
  checker.getDeclaredTypeOfSymbol(exportedSymbol(file, name)).getProperties().map((p) => p.name);

beforeAll(() => {
  program = ts.createProgram(["src/index.ts", "src/core/index.ts", "src/element/index.ts"], {
    strict: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    skipLibCheck: true,
    noEmit: true,
  });
  checker = program.getTypeChecker();
});

describe("docs cover the public API", () => {
  it("documents every ScrollVideo prop", () => {
    const props = propertiesOf("src/index.ts", "ScrollVideoProps").filter((p) => p !== "children");
    expect(props.length).toBeGreaterThan(10);
    expect(undocumented(props, page("react/scroll-video"))).toEqual([]);
  });

  it("documents every Section prop", () => {
    const props = propertiesOf("src/index.ts", "SectionProps").filter((p) => p !== "children");
    expect(undocumented(props, page("react/section"))).toEqual([]);
  });

  it("documents every ScrollFrames prop", () => {
    const props = propertiesOf("src/index.ts", "ScrollFramesProps").filter((p) => p !== "children");
    expect(undocumented(props, page("react/scroll-frames"))).toEqual([]);
  });

  it("documents every export of each entry point", () => {
    const names = [
      ...moduleExports("src/index.ts"),
      ...moduleExports("src/core/index.ts"),
      ...moduleExports("src/element/index.ts"),
    ];
    expect(names.length).toBeGreaterThan(20);
    expect(undocumented([...new Set(names)], page("reference/types"))).toEqual([]);
  });

  it("documents every controller method and event", () => {
    const api = page("reference/api");
    const methods = propertiesOf("src/core/index.ts", "ScrollVideoController");
    const events = propertiesOf("src/core/index.ts", "ScrollVideoEventMap");
    expect(undocumented(methods, api)).toEqual([]);
    expect(undocumented(events, api)).toEqual([]);
  });

  it("documents every hook's return value", () => {
    const fields = propertiesOf("src/index.ts", "ScrollVideoState");
    expect(undocumented(fields, page("react/hooks"))).toEqual([]);
  });

  it("documents every <vid-scroll> attribute", () => {
    const element = customElements.get("vid-scroll") as unknown as { observedAttributes: string[] };
    const section = customElements.get("vid-scroll-section") as unknown as { observedAttributes: string[] };
    const text = page("without-react/element");
    expect(undocumented(element.observedAttributes, text)).toEqual([]);
    expect(undocumented(section.observedAttributes.filter((a) => a !== "id"), text)).toEqual([]);
  });

  it("documents every CLI option", () => {
    const help = execFileSync(process.execPath, ["bin/vidscroll.mjs", "--help"], { encoding: "utf8" });
    const options = [...help.matchAll(/^\s+(--[a-z-]+)/gm)].map((m) => m[1]).filter((o) => o !== "--help");
    expect(options.length).toBeGreaterThan(2);
    expect(undocumented(options, page("reference/cli"))).toEqual([]);
  });
});
