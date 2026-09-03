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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Save changes"
      >
        <h2 className="text-base font-semibold text-zinc-900">Save changes</h2>
        <p className="mt-1 text-sm text-zinc-500">{fileName}</p>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-medium text-zinc-700">
            Commit message
          </label>
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Update README.md"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            disabled={saving}
          />

          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canCommit}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Committing..." : "Commit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
