"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { createLowlight, common } from "lowlight";
import { ChevronDown, Sparkles } from "lucide-react";

const lowlightDetect = createLowlight(common);

const LANGUAGES: { value: string; label: string }[] = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "csharp", label: "C# (csharp)" },
  { value: "cs", label: "C# (cs)" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML / HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
  { value: "graphql", label: "GraphQL" },
  { value: "lua", label: "Lua" },
  { value: "r", label: "R" },
  { value: "perl", label: "Perl" },
  { value: "arduino", label: "Arduino" },
];

export function CodeBlockControls({ editor }: { editor: Editor | null }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [lang, setLang] = useState<string>("plaintext");

  useEffect(() => {
    if (!editor) return;
    const ed = editor;

    function update() {
      if (!ed.isActive("codeBlock")) {
        setPos(null);
        return;
      }
      const attrs = ed.getAttributes("codeBlock") as { language?: string | null };
      setLang(attrs.language ?? "plaintext");

      // Find DOM of active codeBlock
      try {
        const { from } = ed.state.selection;
        const $from = ed.state.doc.resolve(from);
        let depth = $from.depth;
        let codeBlockPos: number | null = null;
        for (let d = depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === "codeBlock") {
            codeBlockPos = $from.before(d);
            break;
          }
        }
        // Fallback: find nearest pre in view
        if (codeBlockPos === null) {
          const dom = ed.view.dom.querySelector("pre") as HTMLElement | null;
          if (dom) {
            const r = dom.getBoundingClientRect();
            setPos({ top: r.top, right: window.innerWidth - r.right });
            return;
          }
        } else {
          const dom = ed.view.nodeDOM(codeBlockPos) as HTMLElement | null;
          if (dom) {
            const pre = dom.querySelector("pre") ?? dom as HTMLElement;
            const r = pre.getBoundingClientRect();
            // Position at top-right inside pre (with scroll offset)
            setPos({ top: r.top, right: window.innerWidth - r.right });
            return;
          }
        }
      } catch {}
      setPos(null);
    }

    // Auto-detect intelligent when language is plaintext/auto and content looks like code
    let autoTimer: number | null = null;
    function autoDetect() {
      if (!ed.isActive("codeBlock")) return;
      const attrs = ed.getAttributes("codeBlock") as { language?: string | null };
      const current = attrs.language ?? "plaintext";
      // Only auto if plaintext or empty
      if (current !== "plaintext" && current !== "" && current != null) return;
      try {
        const { from } = ed.state.selection;
        const $from = ed.state.doc.resolve(from);
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === "codeBlock") {
            const text = node.textContent.trim();
            if (text.length < 10) return;
            const result = lowlightDetect.highlightAuto(text);
            // result.data?.language
            const detected = (result as unknown as { data?: { language?: string } })?.data?.language;
            const lang = detected ?? (result as unknown as { language?: string })?.language;
            if (lang && lang !== "plaintext" && LANGUAGES.some((l) => l.value === lang)) {
              // Only set if relevance high - lowlight returns language with high relevance if obvious
              ed.chain().focus().updateAttributes("codeBlock", { language: lang }).run();
            }
            break;
          }
        }
      } catch {}
    }

    function onUpdate() {
      update();
      if (autoTimer) window.clearTimeout(autoTimer);
      // Debounce auto-detect 800ms after typing
      autoTimer = window.setTimeout(autoDetect, 800) as unknown as number;
    }

    ed.on("selectionUpdate", update);
    ed.on("transaction", onUpdate);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    update();

    return () => {
      ed.off("selectionUpdate", update);
      ed.off("transaction", onUpdate);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      if (autoTimer) window.clearTimeout(autoTimer);
    };
  }, [editor]);

  if (!editor || !pos) return null;

  function changeLanguage(value: string) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("codeBlock", { language: value === "plaintext" ? null : value }).run();
    setLang(value);
  }

  function handleAuto() {
    if (!editor) return;
    try {
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === "codeBlock") {
          const text = node.textContent;
          const result = lowlightDetect.highlightAuto(text);
          const detected = (result as unknown as { data?: { language?: string } })?.data?.language ?? (result as unknown as { language?: string })?.language ?? "plaintext";
          changeLanguage(detected);
          break;
        }
      }
    } catch {}
  }

  return (
    <div
      className="fixed z-40 flex items-center gap-1.5 rounded-full border border-border bg-popover px-1.5 py-1 shadow-float backdrop-blur-sm"
      style={{ top: pos.top + 6, right: pos.right + 8 }}
    >
      <button
        type="button"
        onClick={handleAuto}
        title="Detectar lenguaje automáticamente"
        className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Sparkles className="size-3.5" />
      </button>
      <div className="relative">
        <select
          value={lang}
          onChange={(e) => changeLanguage(e.target.value)}
          className="appearance-none rounded-full bg-popover py-1 pl-2.5 pr-6 text-xs font-medium text-popover-foreground outline-none ring-1 ring-border hover:bg-accent focus:ring-2 focus:ring-ring"
          aria-label="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
