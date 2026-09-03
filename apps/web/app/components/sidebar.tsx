"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Folder, Note } from "./types";

type SidebarProps = {
    folders: Folder[];
    documents?: Note[];
    selectedDocumentId?: string | null;
    workspaceLabel?: string;
    status?: string;
    action?: ReactNode;
    onSelectDocument: (note: Note) => void;
}

type FolderTreeProps = {
    folders: Folder[];
    selectedDocumentId?: string | null;
    openFolders: string[];
    level?: number;
    onToggleFolder: (folderId: string) => void;
    onSelectDocument: (note: Note) => void;
};

type DocumentListProps = {
    documents: Note[];
    selectedDocumentId?: string | null;
    level?: number;
    onSelectDocument: (note: Note) => void;
};

export function Sidebar({
    folders,
    documents = [],
    selectedDocumentId = null,
    workspaceLabel = "My Workspace",
    status,
    action,
    onSelectDocument,
}: SidebarProps) {
    const [openFolders, setOpenFolders] = useState<string[]>([]);

    function toggleFolder(folderId: string) {
        setOpenFolders((current) =>
            current.includes(folderId)
                ? current.filter((id) => id !== folderId)
                : [...current, folderId],
        );
    }

    return (
        <aside className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50">
            <div className="flex h-14 items-center justify-between gap-3 border-b border-zinc-200 px-4">
                <span className="text-sm font-semibold">GitNote</span>
                {action}
            </div>

            <div className="p-3">
                <p className="px-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {workspaceLabel}
                </p>

                {status && (
                    <p className="mt-3 px-2 text-sm text-zinc-500">{status}</p>
                )}

                <div className="mt-1 space-y-1">
                    <DocumentList
                        documents={documents}
                        selectedDocumentId={selectedDocumentId}
                        onSelectDocument={onSelectDocument}
                    />
                    <FolderTree
                        folders={folders}
                        selectedDocumentId={selectedDocumentId}
                        openFolders={openFolders}
                        onToggleFolder={toggleFolder}
                        onSelectDocument={onSelectDocument}
                    />
                </div>
            </div>
        </aside>
    )
}

function FolderTree({
    folders,
    selectedDocumentId = null,
    openFolders,
    level = 0,
    onToggleFolder,
    onSelectDocument,
}: FolderTreeProps) {
    return folders.map((folder) => {
        const isOpen = openFolders.includes(folder.id);

        return (
            <div key={folder.id}>
                <button
                    type="button"
                    onClick={() => onToggleFolder(folder.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200"
                    style={{ paddingLeft: `${8 + level * 14}px` }}
                >
                    <span className="w-3 text-xs">
                        {isOpen ? "⌄" : "›"}
                    </span>

                    <span>{isOpen ? "📂" : "📁"}</span>

                    <span className="truncate">{folder.name}</span>
                </button>

                {isOpen && (
                    <div className="mt-1 space-y-1">
                        <DocumentList
                            documents={folder.documents}
                            selectedDocumentId={selectedDocumentId}
                            level={level + 1}
                            onSelectDocument={onSelectDocument}
                        />
                        <FolderTree
                            folders={folder.folders ?? []}
                            selectedDocumentId={selectedDocumentId}
                            openFolders={openFolders}
                            level={level + 1}
                            onToggleFolder={onToggleFolder}
                            onSelectDocument={onSelectDocument}
                        />
                    </div>
                )}
            </div>
        );
    });
}

function DocumentList({
    documents,
    selectedDocumentId = null,
    level = 0,
    onSelectDocument,
}: DocumentListProps) {
    return documents.map((document) => {
        const selected = selectedDocumentId === document.id;

        return (
            <button
                key={document.id}
                type="button"
                onClick={() => onSelectDocument(document)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-200 ${selected
                    ? "bg-zinc-200 text-zinc-900"
                    : "text-zinc-600"
                    }`}
                style={{ paddingLeft: `${8 + level * 14}px` }}
            >
                <span>📄</span>
                <span className="truncate">{document.name}</span>
            </button>
        );
    });
}
