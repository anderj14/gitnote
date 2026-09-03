"use client";

import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";

function isMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Strong block signals
  if (/^#{1,6}\s+\S/m.test(text)) return true;
  if (/```/.test(text)) return true;
  if (/^>\s/m.test(text)) return true;
  if (/^\s*[-*+]\s+\[[ xX]\]\s+/m.test(text)) return true;
  if (/^\s*\|.*\|\s*$/m.test(text) && text.includes("|")) return true;
  if (/^\s*\|?\s*:?-+:?\s*\|/m.test(text)) return true;

  // Lists — require line-start marker
  if (/^\s*[-*+]\s+\S/m.test(text)) return true;
  if (/^\s*\d+\.\s+\S/m.test(text)) return true;

  // Inline strong signals
  if (/\*\*[^*\n]+\*\*/.test(text)) return true;
  if (/__[^_\n]+__/.test(text)) return true;
  if (/(^|[^*])\*[^*\n]+\*([^*]|$)/.test(text)) return true;
  if (/(^|[^_])_[^_\n]+_([^_]|$)/.test(text)) return true;
  if (/\[.+?\]\(.+?\)/.test(text)) return true;
  if (/`[^`\n]+`/.test(text)) return true;

  return false;
}

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const text = clipboardData.getData("text/plain");
            if (!text) return false;

            // Don't intercept if we're inside a code block — keep literal paste
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const editor: any = (this as any).editor;
            if (editor?.isActive?.("codeBlock")) {
              return false;
            }

            // If clipboard has HTML from a rich copy (e.g. browser), let ProseMirror handle HTML instead
            // We only want to handle plain-text markdown copies (VS Code, .md files)
            const html = clipboardData.getData("text/html");
            // If HTML exists and text doesn't look like markdown, don't intercept
            // This preserves table paste, etc.
            if (html && html.trim().length > 0) {
              // If text is markdown-like, prefer markdown handling; otherwise let HTML win
              if (!isMarkdown(text)) return false;
              // Even if markdown, if HTML contains table/structured content, let HTML win
              // Simple heuristic: html contains <table, <ul>, <ol> and text is same content without markers
              // For markdown tables, text would contain |, but HTML paste from Tiptap itself contains tables;
              // we should not double-convert. Since Tiptap copy already produces HTML, isMarkdown would be false for its HTML text.
              // So safe to still handle markdown when detected.
            }

            if (!isMarkdown(text)) return false;

            // Must have markdown manager
            if (!editor?.markdown) return false;

            try {
              // Prevent default paste and insert via markdown pipeline
              event.preventDefault();

              // Use the Markdown extension's insertContent with contentType markdown
              // This reuses the official parse path (editor.markdown.parse) without custom parser
              editor.chain().focus().insertContent(text, { contentType: "markdown" }).run();

              return true;
            } catch {
              return false;
            }
          },
        },
      }),
    ];
  },
});
