"use client"

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Editor } from "./editor";
import type { Folder, Note } from "./types";

const initialFolders: Folder[] = [
    {
        id: "ideas",
        name: "Ideas",
        documents: [
            {
                id: "saas-ideas",
                name: "SaaS Ideas",
                path: "ideas/saas-ideas.md",
                content: "# SaaS Ideas\n\nIdeas para nuevos productos.",
            },
            {
                id: "youtube-ideas",
                name: "YouTube Ideas",
                path: "ideas/youtube-ideas.md",
                content: "# YouTube Ideas\n\nIdeas para próximos videos.",
            },
        ],
    },
    {
        id: "projects",
        name: "Projects",
        documents: [
            {
                id: "gitnote",
                name: "GitNote",
                path: "projects/gitnote.md",
                content:
                    "# GitNote\n\nAplicación para organizar notas en Markdown.",
            },
        ],
    },
    {
        id: "youtube",
        name: "YouTube",
        documents: [
            {
                id: "jwt",
                name: "JWT vs Cookies",
                path: "youtube/jwt-vs-cookies.md",
                content:
                    "# JWT vs Cookies\n\nComparación entre JWT, cookies, CSRF y autenticación.",
            },
            {
                id: "multitenancy",
                name: "Multi-tenancy",
                path: "youtube/multi-tenancy.md",
                content:
                    "# Multi-tenancy\n\nArquitectura para construir aplicaciones SaaS multitenant.",
            },
        ],
    },
    {
        id: "documentation",
        name: "Documentation",
        documents: [
            {
                id: "sql",
                name: "SQL",
                path: "documentation/sql.md",
                content: "# SQL\n\nNotas sobre SQL y bases de datos.",
            },
            {
                id: "architecture",
                name: "Architecture",
                path: "documentation/architecture.md",
                content:
                    "# Architecture\n\nNotas sobre arquitectura de software.",
            },
        ],
    },
];


export function AppShell() {
    const [selectedDocument, setSelectedDocument] = useState<Note | null>(null);
    const [folders, setFolders] = useState<Folder[]>(initialFolders);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const savedFolders = localStorage.getItem("gitnote-folders");

        if (savedFolders) {
            setFolders(JSON.parse(savedFolders));
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        localStorage.setItem(
            "gitnote-folders",
            JSON.stringify(folders),
        );
    }, [folders]);


    function handleContentChange(content: string) {
        if (!selectedDocument) {
            return;
        }

        const updatedDocument = {
            ...selectedDocument,
            content,
        };

        setSelectedDocument(updatedDocument);

        setFolders((currentFolders) =>
            currentFolders.map((folder) => ({
                ...folder,
                documents: folder.documents.map((note) =>
                    note.id === updatedDocument.id
                        ? updatedDocument
                        : note,
                ),
            })),
        );
    }

    function handleNameChange(name: string) {
        if (!selectedDocument) {
            return;
        }

        const updatedDocument = {
            ...selectedDocument,
            name,
        };

        setSelectedDocument(updatedDocument);

        setFolders((currentFolders) =>
            currentFolders.map((folder) => ({
                ...folder,
                documents: folder.documents.map((note) =>
                    note.id === updatedDocument.id
                        ? updatedDocument
                        : note,
                ),
            })),
        );
    }


    return (
        <div className="flex min-h-screen bg-white text-zinc-900">
            <Sidebar
                folders={folders}
                onSelectDocument={setSelectedDocument}
            />

            <main className="min-w-0 flex-1">
                <div className="flex h-14 items-center border-b border-zinc-200 px-6">
                    {selectedDocument ? (
                        <span className="text-sm font-medium">
                            {selectedDocument.name}
                        </span>
                    ) : (
                        <span className="text-sm text-zinc-500">
                            No document selected
                        </span>
                    )}
                </div>

                <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
                    {selectedDocument ? (
                        <Editor
                            key={selectedDocument.id}
                            title={selectedDocument.name}
                            content={selectedDocument.content}
                            onTitleChange={handleNameChange}
                            onChange={handleContentChange}
                        />
                    ) : (
                        <div className="text-center">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Welcome to GitNote
                            </h1>

                            <p className="mt-2 text-sm text-zinc-500">
                                Select a document or create a new one.
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}