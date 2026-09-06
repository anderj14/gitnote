"use client";
import { useMemo } from "react";
import { FileCode2, FilePlus2, Github, PanelLeft, Search, Settings } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "./ui/command";
import { flattenNotes } from "@/app/lib/workspace";
import type { Folder, Note } from "./types";

export function SearchCommand({
  open,
  onOpenChange,
  folders,
  documents,
  onSelectDocument,
  onNewDocument,
  onToggleSidebar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folders: Folder[];
  documents: Note[];
  onSelectDocument: (n: Note) => void;
  onNewDocument: () => void;
  onToggleSidebar: () => void;
}) {
  const allDocs = useMemo(() => flattenNotes(folders, documents), [folders, documents]);
  const run = (fn: () => void) => { onOpenChange(false); fn(); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search documents..." />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Documents">
          {allDocs.slice(0, 8).map((doc) => (
            <CommandItem key={doc.id} value={`${doc.name} ${doc.path}`} onSelect={() => run(() => onSelectDocument(doc))}>
              <FileCode2 className="size-4 text-primary" />
              <span className="flex-1 truncate">{doc.name}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{doc.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onNewDocument)}>
            <FilePlus2 className="size-4" /> New document<CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(onToggleSidebar)}>
            <PanelLeft className="size-4" /> Toggle sidebar<CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => window.location.assign("/api/github/login"))}>
            <Github className="size-4" /> Open GitHub
          </CommandItem>
          <CommandItem onSelect={() => run(() => {})}>
            <Search className="size-4" /> Search documents<CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => {})}>
            <Settings className="size-4" /> Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-4 border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <span>↑↓ Navigate</span><span>↵ Open</span><span>Esc Close</span>
      </div>
    </CommandDialog>
  );
}
