"use client";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-chrome-muted/70" />}
          <span className={i === items.length - 1 ? "truncate font-medium text-chrome-foreground" : "truncate text-chrome-muted"}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}
