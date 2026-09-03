"use client";
import { PanelRightClose, SunMoon } from "lucide-react";
import { Outline, type OutlineItem } from "./outline";
import type { Note } from "./types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-chrome-border px-4 py-4 last:border-b-0"><p className="mb-2.5 label-caps text-chrome-muted">{title}</p>{children}</section>;
}

export function RightPanel({ doc, headings, theme, onToggleTheme, onClose }: { doc: Note | null; headings: OutlineItem[]; theme: "light" | "dark"; onToggleTheme: () => void; onClose: () => void }) {
  const allHeadings: OutlineItem[] = doc ? [{ id: "title", text: doc.name.replace(/\.md$/, ""), level: 1 }, ...headings] : headings;
  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-chrome-border bg-chrome">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-chrome-border px-4">
        <span className="text-[13px] font-medium text-chrome-foreground">Document</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Toggle theme" onClick={onToggleTheme} className="grid size-7 place-items-center rounded-md text-chrome-muted hover:bg-chrome-hover hover:text-chrome-foreground">
            <SunMoon className="size-4" />
          </button>
          <button type="button" aria-label="Hide panel" onClick={onClose} className="grid size-7 place-items-center rounded-md text-chrome-muted hover:bg-chrome-hover hover:text-chrome-foreground">
            <PanelRightClose className="size-4" />
          </button>
        </div>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto">
        <Section title="Outline"><Outline items={allHeadings} /></Section>
        <Section title="Document">
          {doc ? (
            <div className="space-y-2 text-xs">
              <div><p className="label-caps text-chrome-muted">Path</p><p className="font-mono text-[12px] text-chrome-foreground">{doc.path}</p></div>
              <div><p className="label-caps text-chrome-muted">Words</p><p className="text-chrome-foreground">{doc.content.split(/\s+/).filter(Boolean).length}</p></div>
              {doc.source && <div><p className="label-caps text-chrome-muted">Branch</p><p className="font-mono text-[12px] text-chrome-foreground">{doc.source.branch}</p></div>}
            </div>
          ) : <p className="text-xs text-chrome-muted">No document selected</p>}
        </Section>
        <Section title="Appearance">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(["light", "dark"] as const).map((t) => (
              <button key={t} type="button" onClick={onToggleTheme} className={`flex-1 rounded-md px-2 py-1 text-xs capitalize ${theme === t ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-chrome-muted">⌘⇧L toggle · ⌘. panel</p>
        </Section>
      </div>
    </aside>
  );
}
