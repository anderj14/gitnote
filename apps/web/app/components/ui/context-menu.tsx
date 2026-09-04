"use client";
import * as React from "react";
import { cn } from "@/app/lib/utils";

type ContextMenuProps = {
  children: React.ReactNode;
  items: { label: string; icon?: React.ReactNode; onClick: () => void; destructive?: boolean; disabled?: boolean; separatorBefore?: boolean }[];
  className?: string;
};

export function ContextMenuTrigger({ children, items, className }: ContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: 60,
  };

  return (
    <>
      <div onContextMenu={onContextMenu} className={className}>{children}</div>
      {open && (
        <div
          ref={menuRef}
          style={style}
          className="min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-float animate-in fade-in-0 zoom-in-95"
          role="menu"
        >
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.separatorBefore && <div className="my-1 h-px bg-border" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  item.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
                  item.disabled && "opacity-50 pointer-events-none",
                )}
              >
                {item.icon && <span className="size-3.5 shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
}

// Also export a simple dropdown-style menu for click trigger (e.g. three-dots)
export function DropdownMenu({ trigger, items }: { trigger: React.ReactNode; items: ContextMenuProps["items"] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-float">
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.separatorBefore && <div className="my-1 h-px bg-border" />}
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px]",
                  item.destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
