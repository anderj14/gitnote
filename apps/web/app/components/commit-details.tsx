"use client";

import { ArrowRightLeft, FilePlus2, FilePenLine, Trash2, Copy, Check, Clock3, GitCommit as GitCommitIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "./ui/spinner";

export type CommitFile = {
  path: string;
  previousPath?: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  sha?: string;
};

export type CommitDetailsData = {
  sha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorAvatarUrl?: string;
  date: string;
  parentSha?: string;
  files: CommitFile[];
  stats: { additions: number; deletions: number; total: number };
};

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function shortSha(sha: string) {
  return sha.slice(0, 7);
}

const statusMeta: Record<CommitFile["status"], { label: string; short: string; icon: React.ReactNode; cls: string }> = {
  modified: { label: "Modified", short: "M", icon: <FilePenLine className="size-3" />, cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300" },
  added: { label: "Added", short: "A", icon: <FilePlus2 className="size-3" />, cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300" },
  removed: { label: "Deleted", short: "D", icon: <Trash2 className="size-3" />, cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300" },
  renamed: { label: "Renamed", short: "R", icon: <ArrowRightLeft className="size-3" />, cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300" },
};

type Props = {
  commit: CommitDetailsData;
  selectedPath?: string | null;
  onSelectFile: (file: CommitFile) => void;
  onRestoreCommit: () => void;
  onRestoreFile: (file: CommitFile) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onBack?: () => void;
};

export function CommitDetails({ commit, selectedPath, onSelectFile, onRestoreCommit, onRestoreFile, loading, error, onRetry, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  function copySha() {
    navigator.clipboard.writeText(commit.sha).then(() => {
      setCopied(true);
      toast.success("Commit SHA copied");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-10 place-items-center rounded-full border border-chrome-border bg-card shadow-panel">
          <Spinner size={20} />
        </span>
        <p className="text-sm text-chrome-muted">Loading commit details…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-destructive">Unable to load commit details.</p>
        <p className="mt-1 text-xs text-chrome-muted">{error}</p>
        <div className="mt-4 flex gap-2">
          {onBack && <button type="button" onClick={onBack} className="rounded-md border border-chrome-border px-3 py-1.5 text-xs">Back</button>}
          {onRetry && <button type="button" onClick={onRetry} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">Retry</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-chrome">
      <div className="shrink-0 border-b border-chrome-border bg-chrome px-6 py-4">
        {onBack && (
          <button type="button" onClick={onBack} className="mb-3 text-xs text-chrome-muted hover:text-chrome-foreground">
            ← Back to history
          </button>
        )}
        <h2 className="font-display text-[15px] font-semibold leading-6 text-chrome-foreground">{commit.message.split("\n")[0]}</h2>
        {commit.message.split("\n").slice(1).join("\n").trim() && (
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-chrome-muted">{commit.message.split("\n").slice(1).join("\n").trim()}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-chrome-muted">
          <span className="font-medium text-chrome-foreground">{commit.authorName}</span>
          <span>·</span>
          <Clock3 className="size-3" />
          <span>{formatDateFull(commit.date)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <GitCommitIcon className="size-3.5 text-chrome-muted" />
          <span className="font-mono text-xs text-chrome-muted">{shortSha(commit.sha)}</span>
          <button type="button" onClick={copySha} className="grid size-6 place-items-center rounded hover:bg-chrome-hover text-chrome-muted" aria-label="Copy SHA">
            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          </button>
          <span className="font-mono text-[11px] text-chrome-muted truncate">{commit.sha}</span>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onRestoreCommit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Restore this commit
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-chrome-border bg-chrome-hover/30 px-4 py-2">
        <span className="label-caps text-chrome-muted">{commit.files.length} files changed</span>
        <span className="font-mono text-[11px] text-chrome-muted">
          <span className="text-emerald-600">+{commit.stats.additions}</span> <span className="text-red-500">-{commit.stats.deletions}</span>
        </span>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-0.5">
          {commit.files.map((f) => {
            const meta = statusMeta[f.status];
            const isSelected = selectedPath === f.path;
            return (
              <div key={f.path} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${isSelected ? "border-primary bg-chrome-active" : "border-transparent hover:bg-chrome-hover hover:border-chrome-border"}`}>
                <button type="button" onClick={() => onSelectFile(f)} className="flex flex-1 items-center gap-2 text-left min-w-0">
                  <span className={`inline-flex shrink-0 items-center justify-center rounded border px-1 py-0.5 font-mono text-[11px] font-semibold ${meta.cls}`}>{meta.short}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-chrome-foreground">
                    {f.status === "renamed" && f.previousPath ? (
                      <span className="truncate">
                        <span className="text-chrome-muted">{f.previousPath}</span> <span>→</span> {f.path}
                      </span>
                    ) : (
                      f.path
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-chrome-muted">
                    {f.additions > 0 && <span className="text-emerald-600">+{f.additions}</span>} {f.deletions > 0 && <span className="text-red-500">-{f.deletions}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRestoreFile(f)}
                  className="shrink-0 rounded border border-chrome-border bg-chrome px-2 py-1 font-mono text-[11px] hover:bg-chrome-hover"
                  title="Restore this file to workspace"
                >
                  Restore
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
