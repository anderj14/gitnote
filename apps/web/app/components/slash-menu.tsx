"use client";
import { useEffect, useState } from "react";
import { Code2, Heading2, Image, List, ListOrdered, Minus, Quote, SquareCheck, Table2, Type } from "lucide-react";
import { cn } from "@/app/lib/utils";
import type { Editor } from "@tiptap/react";

export type SlashType = "paragraph" | "heading" | "bullet" | "numbered" | "check" | "code" | "table" | "quote" | "divider" | "image";

export const SLASH_ITEMS: { type: SlashType; label: string; hint: string; icon: typeof Type }[] = [
  { type: "paragraph", label: "Text", hint: "Plain paragraph", icon: Type },
  { type: "heading", label: "Heading", hint: "Section title", icon: Heading2 },
  { type: "bullet", label: "Bullet list", hint: "Unordered list", icon: List },
  { type: "numbered", label: "Numbered list", hint: "Ordered list", icon: ListOrdered },
  { type: "check", label: "Checklist", hint: "Track tasks", icon: SquareCheck },
  { type: "code", label: "Code", hint: "Syntax highlighted", icon: Code2 },
  { type: "table", label: "Table", hint: "Simple grid", icon: Table2 },
  { type: "quote", label: "Quote", hint: "Callout text", icon: Quote },
  { type: "divider", label: "Divider", hint: "Horizontal rule", icon: Minus },
];

export function SlashMenu({ query, editor, onClose }: { query: string; editor: Editor; onClose: () => void }) {
  const items = SLASH_ITEMS.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [query]);

  function deleteSlash() {
    const { state } = editor;
    const { $from } = state.selection;
    const start = $from.start();
    const end = $from.pos;
    const text = state.doc.textBetween(start, end, "\n", "\n");
    if (text.startsWith("/")) {
      editor.chain().focus().command(({ tr }) => { tr.delete(start, end); return true; }).run();
    }
  }

  function run(type: SlashType) {
    deleteSlash();
    switch (type) {
      case "paragraph": editor.chain().focus().setParagraph().run(); break;
      case "heading": editor.chain().focus().setHeading({ level: 2 }).run(); break;
      case "bullet": editor.chain().focus().toggleBulletList().run(); break;
      case "numbered": editor.chain().focus().toggleOrderedList().run(); break;
      case "check": editor.chain().focus().toggleTaskList().run(); break;
      case "code": editor.chain().focus().toggleCodeBlock().run(); break;
      case "quote": editor.chain().focus().toggleBlockquote().run(); break;
      case "divider": editor.chain().focus().setHorizontalRule().run(); break;
      case "table": editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
    }
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => (i + 1) % Math.max(items.length, 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1)); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[index]) run(items[index].type); }
      else if (e.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, index, editor]);

  if (!items.length) {
    return <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-popover p-3 text-[13px] text-muted-foreground shadow-float">No blocks match “{query}”</div>;
  }
  return (
    <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-float">
      <p className="border-b border-border px-3 py-2 label-caps text-muted-foreground">Insert block</p>
      <div className="scroll-thin max-h-72 overflow-y-auto p-1">
        {items.map((item, i) => (
          <button key={item.type} type="button" onMouseEnter={() => setIndex(i)} onClick={() => run(item.type)} className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors", i === index ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
            <span className="grid size-6 shrink-0 place-items-center rounded border border-border"><item.icon className="size-3.5" /></span>
            <span className="flex-1 truncate font-medium">{item.label}</span>
            <span className="truncate text-[11px] opacity-70">{item.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
