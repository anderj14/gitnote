"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FileCode2, Folder, FolderOpen, Github, Plus, Settings } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { RepoCard } from "./git-status";
import type { Folder as FolderType, Note } from "./types";

type SidebarProps = {
  folders: FolderType[];
  documents?: Note[];
  selectedDocumentId?: string | null;
  workspaceLabel?: string;
  status?: string;
  action?: ReactNode;
  repoName?: string | null;
  repoBranch?: string | null;
  onSelectDocument: (note: Note) => void;
  onNewDocument?: () => void;
};

export function Sidebar({
  folders,
  documents = [],
  selectedDocumentId = null,
  workspaceLabel = "My Workspace",
  status,
  action,
  repoName,
  repoBranch,
  onSelectDocument,
  onNewDocument,
}: SidebarProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    folders.forEach((f) => (init[f.id] = true));
    return init;
  });

  function toggleFolder(folderId: string) {
    setOpenFolders((s) => ({ ...s, [folderId]: !s[folderId] }));
  }

  return (
    <div className="flex h-full flex-col bg-chrome">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-chrome-border px-4">
        <span className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
            <span className="font-mono text-[11px] font-bold">G</span>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-chrome-foreground">GitNote</span>
        </span>
        <span className="flex-1" />
        <span className="hidden sm:block">{action}</span>
      </div>

      <div className="px-3 pt-4">
        <p className="px-2 label-caps text-chrome-muted">Workspace</p>
        <p className="mt-1 px-2 text-[13px] font-medium text-chrome-foreground">{workspaceLabel}</p>
        {onNewDocument && (
          <button type="button" onClick={onNewDocument} className="mt-2 flex w-full items-center gap-2 rounded-lg border border-chrome-border bg-chrome px-2.5 py-2 text-[13px] font-medium text-chrome-foreground shadow-panel transition-colors hover:bg-chrome-hover">
            <Plus className="size-4 text-primary" /> New
          </button>
        )}
        {status && <p className="mt-2 px-2 text-xs text-chrome-muted">{status}</p>}
      </div>

      <div className="scroll-thin mt-4 flex-1 overflow-y-auto px-3 pb-4">
        <nav className="space-y-3">
          {documents.length > 0 && (
            <div>
              <p className="px-2 py-1 label-caps text-chrome-muted">Root</p>
              <div className="space-y-0.5">
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} active={selectedDocumentId === doc.id} onSelect={onSelectDocument} />
                ))}
              </div>
            </div>
          )}
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              selectedDocumentId={selectedDocumentId}
              open={openFolders[folder.id] ?? true}
              onToggle={() => toggleFolder(folder.id)}
              onSelectDocument={onSelectDocument}
              openMap={openFolders}
              onToggleFolder={toggleFolder}
            />
          ))}
          {folders.length === 0 && documents.length === 0 && !status && (
            <p className="px-2 text-sm text-chrome-muted">No files yet.</p>
          )}
        </nav>
      </div>

      <div className="shrink-0 space-y-2 border-t border-chrome-border p-3">
        {repoName && repoBranch ? (
          <RepoCard name={repoName} branch={repoBranch} status="Synced" />
        ) : (
          <div className="rounded-lg border border-dashed border-chrome-border p-3 text-center">
            <p className="text-xs text-chrome-muted">No repository selected</p>
            <p className="mt-1 font-mono text-[11px] text-chrome-muted">Connect GitHub to sync</p>
          </div>
        )}
        <div className="flex items-center gap-1 text-chrome-muted">
          <a href="#" className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-chrome-hover hover:text-chrome-foreground">
            <Settings className="size-3.5" /> Settings
          </a>
          <a href="/api/github/login" aria-label="GitHub integration" className="rounded-md p-1.5 transition-colors hover:bg-chrome-hover hover:text-chrome-foreground">
            <Github className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  selectedDocumentId,
  open,
  onToggle,
  onSelectDocument,
  openMap,
  onToggleFolder,
}: {
  folder: FolderType;
  selectedDocumentId: string | null | undefined;
  open: boolean;
  onToggle: () => void;
  onSelectDocument: (n: Note) => void;
  openMap: Record<string, boolean>;
  onToggleFolder: (id: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-chrome-foreground transition-colors hover:bg-chrome-hover"
      >
        {open ? <FolderOpen className="size-3.5 shrink-0 text-primary/70" /> : <Folder className="size-3.5 shrink-0 text-chrome-muted" />}
        <span className="truncate">{folder.name}</span>
        <span className="ml-auto text-[11px] text-chrome-muted">{folder.documents.length + (folder.folders?.length ?? 0)}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 border-l border-chrome-border ml-2 pl-2">
          {folder.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} active={selectedDocumentId === doc.id} onSelect={onSelectDocument} />
          ))}
          {(folder.folders ?? []).map((sub) => (
            <FolderRow
              key={sub.id}
              folder={sub}
              selectedDocumentId={selectedDocumentId}
              open={openMap[sub.id] ?? true}
              onToggle={() => onToggleFolder(sub.id)}
              onSelectDocument={onSelectDocument}
              openMap={openMap}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, active, onSelect }: { doc: Note; active: boolean; onSelect: (n: Note) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(doc)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        active ? "bg-chrome-active text-chrome-foreground font-medium" : "text-chrome-muted hover:bg-chrome-hover hover:text-chrome-foreground",
      )}
    >
      <FileCode2 className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-chrome-muted")} />
      <span className="truncate">{doc.name}</span>
    </button>
  );
}
