"use client";

import { Clock3, GitCommit as GitCommitIcon, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "./ui/spinner";

export type HistoryCommit = {
  sha: string;
  message: string;
  authorName: string;
  authorAvatarUrl?: string;
  date: string;
  parentSha?: string;
};

type GitHistoryProps = {
  commits: HistoryCommit[];
  selectedSha?: string | null;
  onSelect: (sha: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (hours < 48) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

export function GitHistory({ commits, selectedSha, onSelect, loading, error, onRetry }: GitHistoryProps) {
  const [copied, setCopied] = useState<string | null>(null);

  function copySha(sha: string) {
    navigator.clipboard.writeText(sha).then(() => {
      setCopied(sha);
      toast.success("Commit SHA copied");
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
        <span className="grid size-8 place-items-center rounded-full border border-chrome-border bg-card">
          <Spinner size={16} />
        </span>
        <p className="text-sm text-chrome-muted">Loading history…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-sm text-destructive">Unable to load commit history.</p>
        <p className="mt-1 text-xs text-chrome-muted">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-chrome-border bg-chrome px-3 py-1 text-xs hover:bg-chrome-hover">
            Retry
          </button>
        )}
      </div>
    );
  }
  if (commits.length === 0) {
    return <div className="px-3 py-6 text-center text-sm text-chrome-muted">No commits yet.</div>;
  }

  return (
    <div className="space-y-1 px-2 py-2">
      {commits.map((c) => {
        const isSelected = selectedSha === c.sha;
        const firstLine = c.message.split("\n")[0];
        return (
          <div
            key={c.sha}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(c.sha)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(c.sha);
              }
            }}
            className={`flex w-full cursor-pointer flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors ${isSelected ? "border-primary bg-chrome-active" : "border-transparent bg-transparent hover:bg-chrome-hover hover:border-chrome-border"}`}
          >
            <span className="line-clamp-2 text-[13px] font-medium leading-5 text-chrome-foreground">{firstLine}</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-chrome-muted">
              <span className="truncate">{c.authorName}</span>
              <span>·</span>
              <Clock3 className="size-3 shrink-0" />
              <span>{formatDate(c.date)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <GitCommitIcon className="size-3 text-chrome-muted" />
              <span className="font-mono text-[11px] text-chrome-muted">{shortSha(c.sha)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copySha(c.sha);
                }}
                className="ml-auto grid size-5 place-items-center rounded hover:bg-chrome-active text-chrome-muted"
                aria-label="Copy SHA"
              >
                {copied === c.sha ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HistoryHeader({ count, collapsed, onToggle }: { count: number; collapsed: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-chrome-hover">
      <span className="flex items-center gap-2">
        <span className="label-caps text-chrome-muted">History</span>
        <span className="rounded-full bg-chrome-active px-1.5 py-0.5 font-mono text-[11px] text-chrome-muted">{count} commits</span>
      </span>
      <span className="text-[11px] text-chrome-muted">{collapsed ? "Show" : "Hide"}</span>
    </button>
  );
}
