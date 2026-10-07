export const vidscrollTheme = {
  name: "vidscroll",
  type: "dark",
  colors: {
    "editor.background": "#110c13",
    "editor.foreground": "#fff3e3",
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#fff3e373", fontStyle: "italic" } },
    { scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.operator.expression"], settings: { foreground: "#c9a7e8" } },
    { scope: ["string", "string.quoted", "string.template", "punctuation.definition.string"], settings: { foreground: "#f6b98e" } },
    { scope: ["entity.name.tag", "support.class.component", "entity.name.type.class"], settings: { foreground: "#7fd8c9" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#e9c98b" } },
    { scope: ["constant.numeric", "constant.language", "constant.language.boolean"], settings: { foreground: "#f29bb0" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#fff3e3" } },
    { scope: ["entity.name.type", "support.type", "support.type.primitive"], settings: { foreground: "#7fd8c9" } },
    { scope: ["variable", "variable.other", "variable.parameter", "meta.object-literal.key"], settings: { foreground: "#fff3e3" } },
    { scope: ["punctuation", "meta.brace", "punctuation.definition.tag", "punctuation.separator", "punctuation.terminator", "keyword.operator"], settings: { foreground: "#fff3e38c" } },
    { scope: ["support.type.property-name.css", "support.type.property-name"], settings: { foreground: "#e9c98b" } },
    { scope: ["entity.name.tag.css", "entity.other.attribute-name.class.css"], settings: { foreground: "#7fd8c9" } },
  ],
};
