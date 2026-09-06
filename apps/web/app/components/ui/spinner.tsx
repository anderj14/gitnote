"use client";

import { cn } from "@/app/lib/utils";

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block animate-spin rounded-full border-2 border-chrome-border border-t-primary", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingState({
  label,
  description,
  size = 24,
  className,
}: {
  label: string;
  description?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full border border-chrome-border bg-card shadow-panel">
        <Spinner size={size} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-chrome-foreground">{label}</p>
        {description && <p className="text-xs text-chrome-muted">{description}</p>}
      </div>
    </div>
  );
}

export function InlineSpinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-chrome-muted", className)}>
      <Spinner size={14} />
      {label && <span>{label}</span>}
    </span>
  );
}
