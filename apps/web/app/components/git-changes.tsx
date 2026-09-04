"use client";

import { FilePlus2, FilePenLine, Trash2, ArrowRightLeft, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { WorkspaceChange } from "@/app/lib/workspace-changes";

type GitChangesProps = {
  changes: WorkspaceChange[];
  selectedId: string | null;
  onSelect: (change: WorkspaceChange) => void;
  repoConnected: boolean;
};

const typeMeta: Record<
  WorkspaceChange["type"],
  { label: string; short: string; icon: React.ReactNode; badgeClass: string }
> = {
  modified: {
    label: "Modified",
    short: "M",
    icon: <FilePenLine className="size-3.5" />,
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  },
  added: {
    label: "Added",
    short: "A",
    icon: <FilePlus2 className="size-3.5" />,
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  deleted: {
    label: "Deleted",
    short: "D",
    icon: <Trash2 className="size-3.5" />,
    badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
  },
  renamed: {
    label: "Renamed",
    short: "R",
    icon: <ArrowRightLeft className="size-3.5" />,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  },
};

export function GitChanges({ changes, selectedId, onSelect, repoConnected }: GitChangesProps) {
  const grouped = {
    modified: changes.filter((c) => c.type === "modified"),
    added: changes.filter((c) => c.type === "added"),
    deleted: changes.filter((c) => c.type === "deleted"),
    renamed: changes.filter((c) => c.type === "renamed"),
  };

  if (!repoConnected) {
    return null;
  }

  if (changes.length === 0) {
    return (
      <div className="px-3 py-3">
        <div className="rounded-lg border border-chrome-border bg-chrome-hover/40 px-3 py-4 text-center">
          <div className="mx-auto grid size-7 place-items-center rounded-full bg-success/10 text-success">
            <Check className="size-4" />
          </div>
          <p className="mt-2 text-[13px] font-medium text-chrome-foreground">Everything is up to date</p>
          <p className="mt-1 text-xs text-chrome-muted">Your workspace matches the repository.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-2">
      <div className="space-y-4">
        {(["renamed", "modified", "added", "deleted"] as const).map((type) => {
          const list = grouped[type];
          if (list.length === 0) return null;
          const meta = typeMeta[type];
          return (
            <div key={type}>
              <div className="flex items-center gap-1.5 px-2 py-1">
                <span className="label-caps text-chrome-muted">{meta.label}</span>
                <span className="rounded bg-chrome-active px-1.5 py-0.5 font-mono text-[11px] text-chrome-muted">{list.length}</span>
              </div>
              <div className="space-y-0.5">
                {list.map((change) => {
                  const isSelected = selectedId === change.id;
                  return (
                    <button
                      key={change.id}
                      type="button"
                      onClick={() => onSelect(change)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                        isSelected ? "bg-chrome-active text-chrome-foreground" : "hover:bg-chrome-hover text-chrome-muted hover:text-chrome-foreground"
                      }`}
                    >
                      <span className={`inline-flex shrink-0 items-center justify-center rounded border px-1 py-0.5 font-mono text-[11px] font-semibold ${meta.badgeClass}`}>
                        {meta.short}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                        {change.type === "renamed" ? (
                          <span className="flex flex-col">
                            <span className="truncate text-[11px] opacity-70">{change.oldPath}</span>
                            <span className="flex items-center gap-1 truncate">
                              <span className="text-chrome-muted">→</span>
                              <span className="truncate font-medium text-chrome-foreground">{change.path}</span>
                            </span>
                            {change.isModifiedAfterRename && <span className="text-[11px] text-amber-600">+ modified</span>}
                          </span>
                        ) : (
                          <span className="truncate">{change.path}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChangesHeader({
  count,
  collapsed,
  onToggle,
}: {
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-chrome-hover"
    >
      <span className="flex items-center gap-2">
        <span className="label-caps text-chrome-muted">Changes</span>
        {count > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-foreground">{count}</span>
        )}
        {count === 0 && <span className="font-mono text-[11px] text-success">Synced</span>}
      </span>
      {collapsed ? <ChevronDown className="size-3.5 text-chrome-muted" /> : <ChevronUp className="size-3.5 text-chrome-muted" />}
    </button>
  );
}
