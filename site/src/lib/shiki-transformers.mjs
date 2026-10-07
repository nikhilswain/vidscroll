export const codeMeta = {
  name: "vidscroll-code-meta",
  pre(node) {
    const raw = this.options.meta?.__raw ?? "";
    const title = /title="([^"]+)"/.exec(raw)?.[1];
    if (title) node.properties["data-title"] = title;
  },
};
