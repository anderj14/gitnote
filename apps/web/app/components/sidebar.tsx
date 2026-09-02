"use client";

import { useState } from "react";
import type {Folder, Note} from "./types";

type SidebarProps = {
    folders: Folder[];
    onSelectDocument: (note: Note) => void;
}



export function Sidebar({ folders, onSelectDocument }: SidebarProps) {
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
            <div className="flex h-14 items-center border-b border-zinc-200 px-4">
                <span className="text-sm font-semibold">Gitnote</span>
            </div>

            <div className="p-3">
                <p className="px-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    My Workspace
                </p>

                <div className="mt-1 space-y-1">
                    {folders.map((folder) => {
                        const isOpen = openFolders.includes(folder.id);

                        return (
                            <div key={folder.id}>
                                <button
                                    type="button"
                                    onClick={() => toggleFolder(folder.id)}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200"
                                >
                                    <span className="text-xs">
                                        {isOpen ? "⌄" : "›"}
                                    </span>

                                    <span>{isOpen ? "📂" : "📁"}</span>

                                    <span>{folder.name}</span>
                                </button>

                                {isOpen && (
                                    <div className="ml-7 mt-1 space-y-1">
                                        {folder.documents.map((document) => (
                                            <button
                                                key={document.id}
                                                type="button"
                                                onClick={() => onSelectDocument(document)}
                                                className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-200"
                                            >
                                                📄 {document.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    )
}