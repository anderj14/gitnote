"use client";

import { Extension } from "@tiptap/core";

export const CodeBlockIndent = Extension.create({
  name: "codeBlockIndent",

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isActive("codeBlock")) return false;
        const { state } = this.editor;
        const { from, to, empty } = state.selection;

        // If range selected, indent each line in range
        if (!empty) {
          const text = state.doc.textBetween(from, to, "\n", "\n");
          if (text.includes("\n")) {
            const lines = text.split("\n");
            const indented = lines.map((l) => "    " + l).join("\n");
            // Replace selection with indented
            this.editor.chain().focus().command(({ tr }) => {
              tr.replaceWith(from, to, state.schema.text(indented));
              return true;
            }).run();
            return true;
          }
        }

        // Single cursor: insert 4 spaces (IDE style, C# = 4)
        this.editor.chain().focus().insertContent("    ").run();
        return true;
      },

      "Shift-Tab": () => {
        if (!this.editor.isActive("codeBlock")) return false;
        const { state } = this.editor;
        const { $from } = state.selection;
        // Find codeBlock node
        let codeBlock: { node: import("@tiptap/pm/model").Node; pos: number } | null = null;
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d);
          if (n.type.name === "codeBlock") {
            codeBlock = { node: n, pos: $from.before(d) };
            break;
          }
        }
        if (!codeBlock) return false;

        const from = $from.pos;
        // Find start of current line
        const textBefore = state.doc.textBetween(codeBlock.pos + 1, from, "\n", "\n");
        const lineStartOffset = textBefore.lastIndexOf("\n") + 1;
        const lineStartPos = codeBlock.pos + 1 + lineStartOffset;
        const lineEndPos = from;
        const lineText = state.doc.textBetween(lineStartPos, lineEndPos, "\n", "\n");
        const match = lineText.match(/^ {1,4}|\t/);
        if (!match) return true; // already at 0, consume
        const dedentLen = match[0].length;
        this.editor.chain().focus().command(({ tr }) => {
          tr.delete(lineStartPos, lineStartPos + dedentLen);
          return true;
        }).run();
        return true;
      },

      Enter: () => {
        if (!this.editor.isActive("codeBlock")) return false;
        const { state } = this.editor;
        const { $from } = state.selection;
        let codeBlock: { node: import("@tiptap/pm/model").Node; pos: number } | null = null;
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d);
          if (n.type.name === "codeBlock") {
            codeBlock = { node: n, pos: $from.before(d) };
            break;
          }
        }
        if (!codeBlock) return false;

        const cursorPos = $from.pos;
        const blockStart = codeBlock.pos + 1;
        // Text from block start to cursor
        const textUpToCursor = state.doc.textBetween(blockStart, cursorPos, "\n", "\n");
        const lines = textUpToCursor.split("\n");
        const currentLine = lines[lines.length - 1] ?? "";
        const indentMatch = currentLine.match(/^\s*/);
        let indent = indentMatch ? indentMatch[0] : "";

        // IDE: if current line ends with { [ ( : then increase indent
        const trimmed = currentLine.trimEnd();
        const shouldIncrease = /[\{\[\(]$/.test(trimmed) || /:\s*$/.test(trimmed);
        if (shouldIncrease) indent += "    ";

        // If next char is } or ] ) and we increased, we could handle but simple: just indent

        this.editor.chain().focus().insertContent("\n" + indent).run();
        return true;
      },
    };
  },
});
