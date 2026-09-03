"use client";
import { Check, GitBranch, Github, Dot } from "lucide-react";
import { cn } from "@/app/lib/utils";

export function GitStatus({ status = "Synced", className }: { status?: "Synced" | "Modified" | "Untracked"; className?: string }) {
  const synced = status === "Synced";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border border-chrome-border px-2 py-1 text-xs font-medium text-chrome-muted", className)}>
      {synced ? <Check className="size-3.5 text-success" /> : <Dot className="size-4 text-warning" />}
      {status}
    </span>
  );
}

export function RepoCard({ name, branch, status = "Synced" }: { name: string; branch: string; status?: "Synced" | "Modified" | "Untracked" }) {
  return (
    <div className="rounded-lg border border-chrome-border bg-chrome-hover/60 p-3">
      <div className="flex items-center gap-2 label-caps text-chrome-muted">
        <Github className="size-3.5" /> GitHub
      </div>
      <p className="mt-2 truncate font-mono text-[13px] font-medium text-chrome-foreground">{name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-chrome-muted">
        <GitBranch className="size-3" /> {branch}
      </p>
      <div className="mt-2.5">
        <GitStatus status={status} className="bg-chrome" />
      </div>
    </div>
  );
}
