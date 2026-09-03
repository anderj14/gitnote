"use client";
import { cn } from "@/app/lib/utils";

export type OutlineItem = { id: string; text: string; level: number };

export function Outline({ items }: { items: OutlineItem[] }) {
  if (items.length === 0) return <p className="text-xs text-chrome-muted">No headings</p>;
  return (
    <nav className="space-y-0.5">
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={cn("block truncate rounded-md px-2 py-1 text-[13px] hover:bg-chrome-hover hover:text-chrome-foreground", item.level === 1 ? "font-medium text-chrome-foreground" : item.level === 2 ? "ml-2 text-chrome-muted" : "ml-4 text-chrome-muted")}>
          {item.text}
        </a>
      ))}
    </nav>
  );
}
