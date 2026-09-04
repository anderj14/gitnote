"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return Promise.resolve(highlighter);
  if (highlighterPromise) return highlighterPromise;
  highlighterPromise = createHighlighter({
    themes: ["github-light"],
    langs: [
      "javascript",
      "typescript",
      "python",
      "csharp",
      "c",
      "cpp",
      "java",
      "go",
      "rust",
      "kotlin",
      "swift",
      "php",
      "ruby",
      "sql",
      "bash",
      "json",
      "yaml",
      "xml",
      "html",
      "css",
      "markdown",
      "diff",
    ],
  }).then((h) => {
    highlighter = h;
    return h;
  });
  return highlighterPromise;
}

// Preload
getHighlighter().catch(() => {});

export const ShikiCodeBlock = Extension.create({
  name: "shikiCodeBlock",

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("shiki-code-block");

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, { doc }) {
            return DecorationSet.empty;
          },
          apply(tr, oldState, _oldDoc, newState) {
            // Recompute if doc changed or language changed
            if (tr.docChanged || tr.getMeta("shiki-force")) {
              return computeDecorations(newState.doc);
            }
            // Also recompute if selection moved to different codeBlock language (for immediate highlight)
            return oldState.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
        view(view) {
          // One-time trigger when highlighter finishes loading (not on every update)
          if (!highlighter) {
            getHighlighter().then(() => {
              // defer to next tick to avoid dispatch during view update
              setTimeout(() => {
                try {
                  view.dispatch(view.state.tr.setMeta("shiki-force", true));
                } catch {}
              }, 0);
            });
          } else {
            // Highlighter already ready: schedule single recompute after mount
            setTimeout(() => {
              try {
                view.dispatch(view.state.tr.setMeta("shiki-force", true));
              } catch {}
            }, 0);
          }
          return {};
        },
      }),
    ];
  },
});

function computeDecorations(doc: import("@tiptap/pm/model").Node): DecorationSet {
  if (!highlighter) return DecorationSet.empty;
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") return true;
    const text = node.textContent;
    const lang = (node.attrs.language as string | null) ?? "plaintext";
    if (!text) return false;

    try {
      // Shiki throws if lang not supported, fallback to plaintext
      const supported = (highlighter!.getLoadedLanguages() as string[]).includes(lang);
      const useLang = supported ? lang : "plaintext";
      const tokens = highlighter!.codeToTokens(text, { lang: useLang as never, theme: "github-light" });
      let from = pos + 1; // +1 for opening of codeBlock
      for (const line of tokens.tokens) {
        for (const token of line) {
          const to = from + token.content.length;
          if (token.color && token.content) {
            // Use inline style for color (Light Modern via github-light)
            const deco = Decoration.inline(from, to, {
              style: `color: ${token.color}`,
            });
            decorations.push(deco);
          }
          from = to;
        }
        // newline between lines (not in tokens)
        from += 1;
      }
    } catch {
      // ignore
    }
    return false; // don't descend into codeBlock children
  });

  return DecorationSet.create(doc, decorations);
}
