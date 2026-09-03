"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useEffect, useState } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { SlashMenu } from "./slash-menu";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { ListKit } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { TableControls } from "./table-controls";
import { MarkdownPaste } from "./markdown-paste-extension";
import type { SaveStatus } from "./types";

type EditorProps = {
  title: string;
  content: string;
  saveStatus: SaveStatus;
  canSave: boolean;
  theme?: "light" | "dark";
  onTitleChange: (title: string) => void;
  onChange: (content: string) => void;
  onSave: () => void;
  onHeadingsChange?: (headings: { id: string; text: string; level: number }[]) => void;
};

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "saving") return <span className="rounded-md border border-chrome-border px-2 py-1 text-xs font-medium text-chrome-muted">Saving…</span>;
  if (status === "unsaved") return <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Unsaved changes</span>;
  if (status === "error") return <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600">Failed to save</span>;
  return <span className="inline-flex items-center gap-1 rounded-md border border-chrome-border bg-chrome px-2 py-1 text-xs font-medium text-success">✓ Saved</span>;
}

export function Editor({ title, content, saveStatus, canSave, theme = "light", onTitleChange, onChange, onSave, onHeadingsChange }: EditorProps) {
  const [slashQuery, setSlashQuery] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, blockquote: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false }),
      Markdown,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      Blockquote,
      ListKit.configure({ taskItem: { nested: true } }),
      TableKit.configure({ table: { resizable: true, cellMinWidth: 80, lastColumnResizable: true } }),
      MarkdownPaste,
    ],
    content,
    contentType: "markdown",
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getMarkdown());
      onHeadingsChange?.(extractHeadings(editor));
      const { $from } = editor.state.selection;
      const text = editor.state.doc.textBetween($from.start(), $from.pos, "\n", "\n");
      if (text.startsWith("/") && $from.parentOffset <= text.length) {
        setSlashQuery(text.slice(1));
      } else {
        setSlashQuery(null);
      }
    },
    onSelectionUpdate({ editor }) {
      const { $from } = editor.state.selection;
      const text = editor.state.doc.textBetween($from.start(), $from.pos, "\n", "\n");
      if (text.startsWith("/") && $from.parentOffset <= text.length) {
        setSlashQuery(text.slice(1));
      } else {
        setSlashQuery(null);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentContent = editor.getMarkdown();
    if (currentContent !== content) {
      editor.commands.setContent(content, { contentType: "markdown" });
    }
  }, [editor, content]);

  useEffect(() => {
    if (!editor || !onHeadingsChange) return;
    onHeadingsChange(extractHeadings(editor));
  }, [editor, onHeadingsChange, content]);

  if (!editor) return null;

function extractHeadings(editor: any): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  editor.state.doc.descendants((node: any) => {
    if (node.type.name === "heading") {
      const text = node.textContent;
      const level = node.attrs.level;
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      headings.push({ id, text, level });
    }
  });
  return headings;
}

  return (
    <div className={`flex h-full w-full flex-col bg-editor ${theme === "light" ? "editor-light" : ""}`}>
      <div className="shrink-0 border-b border-editor-border bg-editor px-6 py-3">
        <div className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-4">
          <span className="font-mono text-[11px] text-editor-muted">Markdown · {saveStatus === "saved" ? "Synced" : saveStatus}</span>
          <div className="flex items-center gap-2">
            <SaveStatusLabel status={saveStatus} />
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave || saveStatus === "saving"}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveStatus === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col px-8 py-12 md:px-12 lg:px-16">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent font-display text-[2rem] font-semibold tracking-tight text-editor-foreground outline-none placeholder:text-editor-muted/60"
          />
          <p className="mt-2 font-mono text-[12px] text-editor-muted">Markdown document</p>

          <div className="mt-6 rounded-xl border border-editor-border bg-editor-raised/40 p-2">
            <EditorToolbar editor={editor} />
          </div>

          <div className="mt-8 flex-1">
            <div className="relative min-h-[50vh]">
              {slashQuery !== null && <SlashMenu query={slashQuery} editor={editor} onClose={() => setSlashQuery(null)} />}
              <EditorContent editor={editor} className="min-h-[50vh]" />
              <TableControls editor={editor} />
            </div>
            {slashQuery !== null && <p className="mt-2 font-mono text-[11px] text-editor-muted">↑↓ navigate · ↵ select · Esc close</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
