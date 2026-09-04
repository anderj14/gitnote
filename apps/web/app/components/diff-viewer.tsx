"use client";

import { diffLines, type DiffLine } from "@/app/lib/diff";
import { ArrowRightLeft, FilePlus2, Trash2, FilePenLine } from "lucide-react";
import { useMemo } from "react";

type DiffViewerProps = {
  path: string;
  oldPath?: string;
  type: "modified" | "added" | "deleted" | "renamed";
  oldContent?: string;
  content?: string;
  isModifiedAfterRename?: boolean;
  isLoadingOriginal?: boolean;
  originalError?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
  onCommit?: () => void;
};

function DiffLineRow({ line }: { line: DiffLine }) {
  const bg =
    line.type === "added"
      ? "bg-emerald-50 dark:bg-emerald-500/10 border-l-emerald-500"
      : line.type === "removed"
        ? "bg-red-50 dark:bg-red-500/10 border-l-red-500"
        : "bg-transparent border-l-transparent";
  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "−" : " ";
  const textColor =
    line.type === "added"
      ? "text-emerald-800 dark:text-emerald-300"
      : line.type === "removed"
        ? "text-red-700 dark:text-red-300"
        : "text-editor-foreground/80";

  return (
    <div className={`flex gap-3 border-l-2 px-3 py-0.5 font-mono text-[12.5px] leading-6 ${bg}`}>
      <span className="w-10 shrink-0 select-none text-right text-[11px] text-chrome-muted">
        {line.oldLineNumber ?? line.newLineNumber ?? ""}
      </span>
      <span className={`w-3 shrink-0 select-none text-center ${line.type === "added" ? "text-emerald-600" : line.type === "removed" ? "text-red-500" : "text-chrome-muted"}`}>{prefix}</span>
      <span className={`min-w-0 flex-1 whitespace-pre-wrap break-all ${textColor}`}>{line.value || " "}</span>
    </div>
  );
}

export function DiffViewer({ path, oldPath, type, oldContent = "", content = "", isModifiedAfterRename, isLoadingOriginal, originalError, onRetry, onClose, onCommit }: DiffViewerProps) {
  const lines = useMemo(() => {
    if (isLoadingOriginal || originalError) return [];
    if (type === "renamed" && !isModifiedAfterRename) return [];
    const oldC = type === "added" ? "" : oldContent ?? "";
    const newC = type === "deleted" ? "" : content ?? "";
    return diffLines(oldC, newC);
  }, [oldContent, content, type, isModifiedAfterRename, isLoadingOriginal, originalError]);

  const added = lines.filter((l) => l.type === "added").length;
  const removed = lines.filter((l) => l.type === "removed").length;

  return (
    <div className="flex h-full flex-col bg-editor">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-editor-border bg-editor px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {type === "added" && <FilePlus2 className="size-4 text-emerald-400" />}
            {type === "deleted" && <Trash2 className="size-4 text-red-400" />}
            {type === "modified" && <FilePenLine className="size-4 text-amber-400" />}
            {type === "renamed" && <ArrowRightLeft className="size-4 text-blue-400" />}
            <span className="truncate font-mono text-[13px] font-medium text-editor-foreground">{path}</span>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${badgeClass(type)}`}>{labelForType(type, isModifiedAfterRename)}</span>
          </div>
          {type === "renamed" && oldPath && (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-editor-muted">
              <span className="truncate">{oldPath}</span>
              <span>→</span>
              <span className="truncate font-medium text-editor-foreground">{path}</span>
            </p>
          )}
          {type !== "renamed" || isModifiedAfterRename ? (
            <p className="mt-1 font-mono text-[11px] text-editor-muted">
              {added > 0 && <span className="text-emerald-400">+{added}</span>}
              {added > 0 && removed > 0 && <span> · </span>}
              {removed > 0 && <span className="text-red-400">-{removed}</span>}
              {added === 0 && removed === 0 && <span>No line changes</span>}
            </p>
          ) : (
            <p className="mt-1 font-mono text-[11px] text-editor-muted">No content changes — only path changed</p>
          )}
        </div>
        <div className="ml-4 flex shrink-0 items-center gap-2">
          {onCommit && type !== "deleted" && (
            <button type="button" onClick={onCommit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Commit
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-md border border-editor-border px-2.5 py-1 text-xs text-editor-muted hover:bg-editor-raised">
              Back to editor
            </button>
          )}
        </div>
      </div>

      {/* body */}
      <div className="scroll-thin flex-1 overflow-y-auto">
        {isLoadingOriginal && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-editor-border border-t-primary" />
            <p className="mt-3 font-mono text-sm text-editor-muted">Loading original version...</p>
          </div>
        )}
        {originalError && !isLoadingOriginal && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-mono text-sm text-red-400">Unable to load the original version.</p>
            <p className="mt-1 font-mono text-xs text-editor-muted">{originalError}</p>
            {onRetry && (
              <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-editor-border bg-editor-raised px-3 py-1.5 text-xs text-editor-foreground hover:bg-editor-hover">
                Try again
              </button>
            )}
          </div>
        )}
        {!isLoadingOriginal && !originalError && type === "added" && (
          <div className="mx-auto max-w-[1120px] px-6 py-6">
            <p className="mb-3 font-mono text-xs text-emerald-400">New file — all lines are additions</p>
            <div className="overflow-hidden rounded-xl border border-editor-border bg-editor-raised/40">
              {lines.map((l, idx) => (
                <DiffLineRow key={idx} line={l} />
              ))}
            </div>
          </div>
        )}

        {!isLoadingOriginal && !originalError && type === "deleted" && (
          <div className="mx-auto max-w-[1120px] px-6 py-6">
            <p className="mb-3 font-mono text-xs text-red-400">Deleted file — all lines are removals</p>
            <div className="overflow-hidden rounded-xl border border-editor-border bg-editor-raised/40">
              {lines.map((l, idx) => (
                <DiffLineRow key={idx} line={l} />
              ))}
            </div>
          </div>
        )}

        {!isLoadingOriginal && !originalError && type === "renamed" && !isModifiedAfterRename && (
          <div className="mx-auto flex max-w-[1120px] flex-col items-center px-6 py-16 text-center">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
              <ArrowRightLeft className="size-5" />
            </div>
            <p className="mt-4 font-display text-lg font-semibold text-editor-foreground">Renamed</p>
            <p className="mt-2 font-mono text-sm text-editor-muted">{oldPath}</p>
            <p className="font-mono text-sm text-editor-foreground">→ {path}</p>
          </div>
        )}

        {!isLoadingOriginal && !originalError && (type === "modified" || (type === "renamed" && isModifiedAfterRename)) && (
          <div className="mx-auto max-w-[1120px] px-6 py-6">
            {lines.length === 0 ? (
              <p className="text-sm text-editor-muted">No differences.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-editor-border bg-editor-raised/40">
                <div className="flex border-b border-editor-border bg-editor px-3 py-2 font-mono text-[11px] text-editor-muted">
                  <span className="w-10 text-right">#</span>
                  <span className="w-3 text-center" />
                  <span className="flex-1">Content</span>
                </div>
                {lines.map((l, idx) => (
                  <DiffLineRow key={idx} line={l} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* For pure renamed with content diff, also show if needed above already handles */}
      </div>
    </div>
  );
}

function badgeClass(type: string) {
  switch (type) {
    case "added":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "deleted":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "renamed":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    default:
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  }
}
function labelForType(type: string, modified?: boolean) {
  if (type === "renamed" && modified) return "Renamed · Modified";
  if (type === "modified") return "Modified";
  if (type === "added") return "Added";
  if (type === "deleted") return "Deleted";
  return "Renamed";
}
