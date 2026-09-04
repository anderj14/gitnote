"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FileCode2, Folder, FolderOpen, FolderPlus, Github, Pencil, Trash2, FolderInput, FilePlus2, MoreHorizontal, Settings } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { RepoCard } from "./git-status";
import { ContextMenuTrigger, DropdownMenu } from "./ui/context-menu";
import { getFolderPathById } from "@/app/lib/workspace";
import type { Folder as FolderType, Note } from "./types";
import type { WorkspaceChange } from "@/app/lib/workspace-changes";
import { GitChanges, ChangesHeader } from "./git-changes";
import { GitHistory, HistoryHeader } from "./git-history";
import type { HistoryCommit } from "./git-history";

type SidebarProps = {
  folders: FolderType[];
  documents?: Note[];
  selectedDocumentId?: string | null;
  workspaceLabel?: string;
  status?: string;
  action?: ReactNode;
  repoName?: string | null;
  repoBranch?: string | null;
  repoStatus?: "Synced" | "Modified" | "Untracked";
  changes?: WorkspaceChange[];
  selectedChangeId?: string | null;
  changesCollapsed?: boolean;
  repoConnected?: boolean;
  historyCommits?: HistoryCommit[];
  selectedHistorySha?: string | null;
  historyLoading?: boolean;
  historyError?: string | null;
  historyCollapsed?: boolean;
  fileHistoryCommits?: HistoryCommit[];
  fileHistoryLoading?: boolean;
  fileHistoryError?: string | null;
  fileHistoryCollapsed?: boolean;
  selectedDocumentPath?: string | null;
  onSelectDocument: (note: Note) => void;
  onNewDocument?: () => void;
  onNewFolder?: (parentPath: string | null) => void;
  onNewDocumentAt?: (folderPath: string | null) => void;
  onRenameDocument?: (note: Note) => void;
  onMoveDocument?: (note: Note) => void;
  onDeleteDocument?: (note: Note) => void;
  onRenameFolder?: (folder: FolderType) => void;
  onDeleteFolder?: (folder: FolderType) => void;
  onSelectChange?: (change: WorkspaceChange) => void;
  onToggleChanges?: () => void;
  onSelectHistoryCommit?: (sha: string) => void;
  onToggleHistory?: () => void;
  onRetryHistory?: () => void;
  onToggleFileHistory?: () => void;
  onRetryFileHistory?: () => void;
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
  repoStatus = "Synced",
  changes = [],
  selectedChangeId = null,
  changesCollapsed = false,
  repoConnected = false,
  historyCommits = [],
  selectedHistorySha = null,
  historyLoading = false,
  historyError = null,
  historyCollapsed = false,
  fileHistoryCommits = [],
  fileHistoryLoading = false,
  fileHistoryError = null,
  fileHistoryCollapsed = false,
  selectedDocumentPath = null,
  onSelectDocument,
  onNewDocument,
  onNewFolder,
  onNewDocumentAt,
  onRenameDocument,
  onMoveDocument,
  onDeleteDocument,
  onRenameFolder,
  onDeleteFolder,
  onSelectChange,
  onToggleChanges,
  onSelectHistoryCommit,
  onToggleHistory,
  onRetryHistory,
  onToggleFileHistory,
  onRetryFileHistory,
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
        <div className="mt-2 flex gap-2">
          {onNewDocument && (
            <button type="button" onClick={onNewDocument} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-chrome-border bg-chrome px-2.5 py-2 text-[13px] font-medium text-chrome-foreground shadow-panel transition-colors hover:bg-chrome-hover">
              <FilePlus2 className="size-4 text-primary" /> New
            </button>
          )}
          {onNewFolder && (
            <button type="button" onClick={() => onNewFolder(null)} title="New folder (⌘⇧N)" className="flex items-center justify-center gap-1 rounded-lg border border-chrome-border bg-chrome px-3 py-2 text-[13px] text-chrome-foreground shadow-panel hover:bg-chrome-hover">
              <FolderPlus className="size-4" />
            </button>
          )}
        </div>
        {status && <p className="mt-2 px-2 text-xs text-chrome-muted">{status}</p>}
      </div>

      <ContextMenuTrigger
        className="flex min-h-0 flex-1 flex-col"
        items={[
          { label: "New document", icon: <FilePlus2 className="size-3.5" />, onClick: () => onNewDocumentAt?.(null) },
          { label: "New folder", icon: <FolderPlus className="size-3.5" />, onClick: () => onNewFolder?.(null) },
        ]}
      >
        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-4 mt-4 space-y-4">
          <nav className="space-y-3">
            {documents.length > 0 && (
              <div>
                <ContextMenuTrigger
                  items={[
                    { label: "New document", icon: <FilePlus2 className="size-3.5" />, onClick: () => onNewDocumentAt?.(null) },
                    { label: "New folder", icon: <FolderPlus className="size-3.5" />, onClick: () => onNewFolder?.(null) },
                  ]}
                >
                  <p className="px-2 py-1 label-caps text-chrome-muted">Root</p>
                </ContextMenuTrigger>
                <div className="space-y-0.5">
                  {documents.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      active={selectedDocumentId === doc.id}
                      onSelect={onSelectDocument}
                      onRename={onRenameDocument}
                      onMove={onMoveDocument}
                      onDelete={onDeleteDocument}
                    />
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
                allFolders={folders}
                onNewDocumentAt={onNewDocumentAt}
                onNewFolder={onNewFolder}
                onRenameDocument={onRenameDocument}
                onMoveDocument={onMoveDocument}
                onDeleteDocument={onDeleteDocument}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            ))}
            {folders.length === 0 && documents.length === 0 && !status && (
              <p className="px-2 text-sm text-chrome-muted">No files yet. Right-click to create.</p>
            )}
          </nav>

          {repoConnected && (
            <div className="rounded-lg border border-chrome-border bg-chrome-hover/30">
              <ChangesHeader count={changes.length} collapsed={changesCollapsed} onToggle={() => onToggleChanges?.()} />
              {!changesCollapsed && (
                <div className="border-t border-chrome-border">
                  <GitChanges changes={changes} selectedId={selectedChangeId} onSelect={(c) => onSelectChange?.(c)} repoConnected={repoConnected} />
                </div>
              )}
            </div>
          )}

          {repoConnected && (
            <div className="rounded-lg border border-chrome-border bg-chrome-hover/30">
              <HistoryHeader count={historyCommits.length} collapsed={historyCollapsed} onToggle={() => onToggleHistory?.()} />
              {!historyCollapsed && (
                <div className="border-t border-chrome-border max-h-[320px] overflow-y-auto scroll-thin">
                  <GitHistory commits={historyCommits} selectedSha={selectedHistorySha} onSelect={(sha) => onSelectHistoryCommit?.(sha)} loading={historyLoading} error={historyError} onRetry={onRetryHistory} />
                </div>
              )}
            </div>
          )}

          {repoConnected && selectedDocumentPath && (
            <div className="rounded-lg border border-chrome-border bg-chrome-hover/30">
              <button type="button" onClick={() => onToggleFileHistory?.()} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-chrome-hover">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="label-caps text-chrome-muted truncate">File History</span>
                  <span className="truncate font-mono text-[11px] text-chrome-muted">{selectedDocumentPath.split("/").pop()}</span>
                  <span className="rounded-full bg-chrome-active px-1.5 py-0.5 font-mono text-[11px] text-chrome-muted">{fileHistoryCommits.length}</span>
                </span>
                <span className="text-[11px] text-chrome-muted shrink-0">{fileHistoryCollapsed ? "Show" : "Hide"}</span>
              </button>
              {!fileHistoryCollapsed && (
                <div className="border-t border-chrome-border max-h-[320px] overflow-y-auto scroll-thin">
                  <GitHistory commits={fileHistoryCommits} selectedSha={selectedHistorySha} onSelect={(sha) => onSelectHistoryCommit?.(sha)} loading={fileHistoryLoading} error={fileHistoryError} onRetry={onRetryFileHistory} />
                  {!fileHistoryLoading && !fileHistoryError && fileHistoryCommits.length === 0 && (
                    <p className="px-3 py-2 text-xs text-chrome-muted">No commits yet for this file. It may be new and not yet committed.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      <div className="shrink-0 space-y-2 border-t border-chrome-border p-3">
        {repoName && repoBranch ? (
          <RepoCard name={repoName} branch={repoBranch} status={repoStatus} count={changes.length} />
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
  allFolders,
  onNewDocumentAt,
  onNewFolder,
  onRenameDocument,
  onMoveDocument,
  onDeleteDocument,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: FolderType;
  selectedDocumentId: string | null | undefined;
  open: boolean;
  onToggle: () => void;
  onSelectDocument: (n: Note) => void;
  openMap: Record<string, boolean>;
  onToggleFolder: (id: string) => void;
  allFolders: FolderType[];
  onNewDocumentAt?: (path: string | null) => void;
  onNewFolder?: (parentPath: string | null) => void;
  onRenameDocument?: (n: Note) => void;
  onMoveDocument?: (n: Note) => void;
  onDeleteDocument?: (n: Note) => void;
  onRenameFolder?: (f: FolderType) => void;
  onDeleteFolder?: (f: FolderType) => void;
}) {
  const folderPath = getFolderPathById(allFolders, folder.id) ?? folder.name;
  return (
    <div>
      <ContextMenuTrigger
        items={[
          { label: "New document", icon: <FilePlus2 className="size-3.5" />, onClick: () => onNewDocumentAt?.(folderPath) },
          { label: "New folder", icon: <FolderPlus className="size-3.5" />, onClick: () => onNewFolder?.(folderPath) },
          { label: "Rename", icon: <Pencil className="size-3.5" />, onClick: () => onRenameFolder?.(folder), separatorBefore: true },
          { label: "Delete", icon: <Trash2 className="size-3.5" />, onClick: () => onDeleteFolder?.(folder), destructive: true },
        ]}
      >
        <div className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-chrome-foreground transition-colors hover:bg-chrome-hover">
          <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-1.5 truncate text-left">
            {open ? <FolderOpen className="size-3.5 shrink-0 text-primary/70" /> : <Folder className="size-3.5 shrink-0 text-chrome-muted" />}
            <span className="truncate">{folder.name}</span>
            <span className="ml-auto text-[11px] text-chrome-muted">{folder.documents.length + (folder.folders?.length ?? 0)}</span>
          </button>
          <span className="hidden items-center gap-0.5 group-hover:flex">
            <button type="button" onClick={(e) => { e.stopPropagation(); onNewDocumentAt?.(folderPath); }} className="grid size-6 place-items-center rounded hover:bg-chrome-active" title="New document"><FilePlus2 className="size-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onNewFolder?.(folderPath); }} className="grid size-6 place-items-center rounded hover:bg-chrome-active" title="New folder"><FolderPlus className="size-3.5" /></button>
          </span>
        </div>
      </ContextMenuTrigger>
      {open && (
        <div className="mt-1 space-y-0.5 border-l border-chrome-border ml-2 pl-2">
          {folder.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} active={selectedDocumentId === doc.id} onSelect={onSelectDocument} onRename={onRenameDocument} onMove={onMoveDocument} onDelete={onDeleteDocument} />
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
              allFolders={allFolders}
              onNewDocumentAt={onNewDocumentAt}
              onNewFolder={onNewFolder}
              onRenameDocument={onRenameDocument}
              onMoveDocument={onMoveDocument}
              onDeleteDocument={onDeleteDocument}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  active,
  onSelect,
  onRename,
  onMove,
  onDelete,
}: {
  doc: Note;
  active: boolean;
  onSelect: (n: Note) => void;
  onRename?: (n: Note) => void;
  onMove?: (n: Note) => void;
  onDelete?: (n: Note) => void;
}) {
  const menuItems = [
    { label: "Open", icon: <FileCode2 className="size-3.5" />, onClick: () => onSelect(doc) },
    { label: "Rename", icon: <Pencil className="size-3.5" />, onClick: () => onRename?.(doc) },
    { label: "Move to...", icon: <FolderInput className="size-3.5" />, onClick: () => onMove?.(doc) },
    { label: "Delete", icon: <Trash2 className="size-3.5" />, onClick: () => onDelete?.(doc), destructive: true, separatorBefore: true },
  ];
  return (
    <ContextMenuTrigger items={menuItems}>
      <div
        className={cn(
          "group flex w-full items-center gap-1 rounded-md px-1 py-0.5 transition-colors",
          active ? "bg-chrome-active" : "hover:bg-chrome-hover",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(doc)}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
            active ? "text-chrome-foreground font-medium" : "text-chrome-muted hover:text-chrome-foreground",
          )}
        >
          <FileCode2 className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-chrome-muted")} />
          <span className="truncate flex-1">{doc.name}</span>
        </button>
        <DropdownMenu
          items={menuItems}
          trigger={
            <button
              type="button"
              aria-label="Document actions"
              className="grid size-6 shrink-0 place-items-center rounded-md text-chrome-muted opacity-0 transition-opacity hover:bg-chrome-active hover:text-chrome-foreground group-hover:opacity-100 focus:opacity-100"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          }
        />
      </div>
    </ContextMenuTrigger>
  );
}
