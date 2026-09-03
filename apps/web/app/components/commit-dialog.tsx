"use client";

import { useEffect, useRef } from "react";

type CommitDialogProps = {
  open: boolean;
  fileName: string;
  message: string;
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
        <h2 className="font-display text-base font-semibold text-foreground">Save changes</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{fileName}</p>
        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-medium text-foreground">Commit message</label>
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Update README.md"
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
