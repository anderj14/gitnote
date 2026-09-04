"use client";

import { useEffect, useRef } from "react";

import type { WorkspaceChange } from "@/app/lib/workspace-changes";

type CommitDialogProps = {
  open: boolean;
  fileName: string;
  message: string;
  changes?: WorkspaceChange[];
  onMessageChange: (value: string) => void;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onCommit: (message: string) => void;
};

export function CommitDialog({
  open,
  fileName,
  message,
  changes = [],
  onMessageChange,
  saving,
  error,
  onClose,
  onCommit,
}: CommitDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const trimmed = message.trim();
  const canCommit = trimmed.length > 0 && !saving;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCommit) return;
    onCommit(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!saving) onClose(); }}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-float" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Save changes">
        <h2 className="font-display text-base font-semibold text-foreground">Commit changes</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{fileName}</p>
        {changes.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="label-caps text-muted-foreground">{changes.length} file{changes.length !== 1 ? "s" : ""} changed</p>
            <div className="mt-2 space-y-1">
              {changes.map((c) => (
                <div key={c.id} className="flex items-center gap-2 font-mono text-xs">
                  <span className={`inline-flex shrink-0 rounded border px-1 py-0.5 text-[11px] font-semibold ${badgeCls(c.type)}`}>{short(c.type)}</span>
                  <span className="truncate text-muted-foreground">{c.type === "renamed" && c.oldPath ? `${c.oldPath} → ${c.path}` : c.path}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-medium text-foreground">Commit message</label>
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Update documentation"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            disabled={saving}
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={!canCommit} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Committing…" : "Commit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function short(t: WorkspaceChange["type"]) {
  return t === "modified" ? "M" : t === "added" ? "A" : t === "deleted" ? "D" : "R";
}
function badgeCls(t: WorkspaceChange["type"]) {
  switch (t) {
    case "added": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "deleted": return "bg-red-100 text-red-700 border-red-200";
    case "renamed": return "bg-blue-100 text-blue-700 border-blue-200";
    default: return "bg-amber-100 text-amber-700 border-amber-200";
  }
}
