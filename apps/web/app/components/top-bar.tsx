"use client";
import { Github, PanelLeft, PanelRight, Search, Settings } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { GitStatus } from "./git-status";

export function TopBar({
  breadcrumbs,
  status = "Synced",
  onToggleSidebar,
  onTogglePanel,
  onSearch,
  accountLogin,
}: {
  breadcrumbs: string[];
  status?: "Synced" | "Modified" | "Untracked";
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
  onSearch?: () => void;
  accountLogin?: string | null;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-chrome-border bg-chrome px-3 md:px-4">
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        className="grid size-8 shrink-0 place-items-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-hover hover:text-chrome-foreground"
      >
        <PanelLeft className="size-4" />
      </button>

      <Breadcrumbs items={breadcrumbs} />

      <span className="flex-1" />

      {onSearch && (
        <>
          <button
            type="button"
            onClick={onSearch}
            className="hidden items-center gap-2 rounded-md border border-chrome-border bg-chrome px-2.5 py-1.5 text-[13px] text-chrome-muted transition-colors hover:bg-chrome-hover hover:text-chrome-foreground sm:flex"
          >
            <Search className="size-3.5" />
            <span className="hidden md:inline">Search</span>
            <kbd className="rounded border border-chrome-border bg-chrome-hover px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <button type="button" aria-label="Search" onClick={onSearch} className="grid size-8 place-items-center rounded-md text-chrome-muted hover:bg-chrome-hover sm:hidden">
            <Search className="size-4" />
          </button>
        </>
      )}

      <div className="hidden md:block">
        <GitStatus status={status} />
      </div>

      <a href="/api/github/login" aria-label="GitHub" className="grid size-8 place-items-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-hover hover:text-chrome-foreground">
        <Github className="size-4" />
      </a>
      {onTogglePanel && (
        <button type="button" aria-label="Toggle outline" onClick={onTogglePanel} className="hidden size-8 place-items-center rounded-md text-chrome-muted hover:bg-chrome-hover hover:text-chrome-foreground lg:grid">
          <PanelRight className="size-4" />
        </button>
      )}

      {accountLogin && <span className="hidden text-xs text-chrome-muted md:block">@{accountLogin}</span>}
    </header>
  );
}
