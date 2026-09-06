"use client"

import { useState, useEffect, useRef, useMemo } from "react";
import { Sidebar } from "./sidebar";
import { Editor } from "./editor";
import { CommitDialog } from "./commit-dialog";
import { TopBar } from "./top-bar";
import { SearchCommand } from "./search-command";
import { NewDocumentModal } from "./new-document-modal";
import { NewFolderModal } from "./new-folder-modal";
import { RenameDocumentModal } from "./rename-document-modal";
import { RenameFolderModal } from "./rename-folder-modal";
import { MoveDocumentModal } from "./move-document-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { RightPanel } from "./right-panel";
import { DiffViewer } from "./diff-viewer";
import { GitHistory } from "./git-history";
import { CommitDetails } from "./commit-details";
import { Toaster, toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { LoadingState, Spinner } from "./ui/spinner";
import type { Folder, Note, SaveStatus } from "./types";
import {
  createFolder,
  renameFolder as renameFolderHelper,
  deleteFolder as deleteFolderHelper,
  renameDocument as renameDocumentHelper,
  moveDocument as moveDocumentHelper,
  removeDocument,
  flattenNotes,
  getFolderPathById,
} from "@/app/lib/workspace";
import { getWorkspaceChanges, type OriginalSnapshot, type WorkspaceChange } from "@/app/lib/workspace-changes";

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

type GitHubAccount = {
    id: number;
    login: string;
    name: string | null;
    avatarUrl: string;
};

type GitHubRepository = {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    private: boolean;
    defaultBranch: string;
    description: string | null;
};

type GitHubMarkdownFile = {
    name: string;
    path: string;
    sha: string;
    size?: number;
};

type GitHubRepositoryTree = {
    folders: string[];
    files: GitHubMarkdownFile[];
};

type RepositoryDocuments = {
    folders: Folder[];
    documents: Note[];
};

type SessionResponse =
    | {
        connected: true;
        account: GitHubAccount;
        installUrl: string | null;
    }
    | {
        connected: false;
        error?: string;
        installUrl?: string | null;
    };

type RepositoriesResponse = {
    repositories: GitHubRepository[];
};

type TreeResponse = {
    tree: GitHubRepositoryTree;
};

type FileResponse = {
    file: {
        path: string;
        name: string;
        content: string;
        sha: string;
    };
};

export function AppShell() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [newDocOpen, setNewDocOpen] = useState(false);
    const [newDocInitialFolder, setNewDocInitialFolder] = useState<string | null>(null);
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [newFolderInitialParent, setNewFolderInitialParent] = useState<string | null>(null);
    const [editorTheme, setEditorTheme] = useState<"light" | "dark">("light");
    const [panelOpen, setPanelOpen] = useState(true);
    const [selectedDocument, setSelectedDocument] = useState<Note | null>(null);
    const [folders, setFolders] = useState<Folder[]>(getInitialFolders);
    const [rootDocuments, setRootDocuments] = useState<Note[]>([]);
    const [account, setAccount] = useState<GitHubAccount | null>(null);
    const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
    const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);
    const [repositoriesLoading, setRepositoriesLoading] = useState(false);
    const [treeLoading, setTreeLoading] = useState(false);
    const [documentLoading, setDocumentLoading] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);
    const [githubInstallUrl, setGithubInstallUrl] = useState<string | null>(null);

    // Save flow state (spec: saved | unsaved | saving | error)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
    const [lastSavedContent, setLastSavedContent] = useState<string>("");
    const lastSavedContentRef = useRef<string>("");
    const [commitDialogOpen, setCommitDialogOpen] = useState(false);
    const [commitError, setCommitError] = useState<string | null>(null);
    const [commitMessage, setCommitMessage] = useState("");
    const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);

    // Workspace changes snapshot + diff selection
    const [originalSnapshot, setOriginalSnapshot] = useState<OriginalSnapshot>([]);
    const [selectedChange, setSelectedChange] = useState<WorkspaceChange | null>(null);
    const [viewMode, setViewMode] = useState<"editor" | "diff" | "history" | "commit" | "historyDiff">("editor");
    const [changesCollapsed, setChangesCollapsed] = useState(false);
    const [historyCollapsed, setHistoryCollapsed] = useState(false);
    const [fileHistoryCollapsed, setFileHistoryCollapsed] = useState(false);
    const [originalLoadingIds, setOriginalLoadingIds] = useState<Set<string>>(new Set());
    const [originalErrors, setOriginalErrors] = useState<Map<string, string>>(new Map());
    const originalFetchingRef = useRef<Set<string>>(new Set());

    // History
    type HistoryCommit = { sha: string; message: string; authorName: string; authorEmail?: string; authorAvatarUrl?: string; date: string; parentSha?: string };
    type CommitFile = { path: string; previousPath?: string; status: "added" | "modified" | "removed" | "renamed"; additions: number; deletions: number; sha?: string };
    type CommitDetails = { sha: string; message: string; authorName: string; authorEmail?: string; authorAvatarUrl?: string; date: string; parentSha?: string; files: CommitFile[]; stats: { additions: number; deletions: number; total: number } };
    const [historyCommits, setHistoryCommits] = useState<HistoryCommit[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyFilterPath, setHistoryFilterPath] = useState<string | null>(null);
    const [fileHistoryCommits, setFileHistoryCommits] = useState<HistoryCommit[]>([]);
    const [fileHistoryLoading, setFileHistoryLoading] = useState(false);
    const [fileHistoryError, setFileHistoryError] = useState<string | null>(null);
    const [selectedHistorySha, setSelectedHistorySha] = useState<string | null>(null);
    const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
    const [commitDetailsLoading, setCommitDetailsLoading] = useState(false);
    const [commitDetailsError, setCommitDetailsError] = useState<string | null>(null);
    const commitDetailsCache = useRef<Map<string, CommitDetails>>(new Map());
    const [selectedHistoryFile, setSelectedHistoryFile] = useState<CommitFile | null>(null);
    const [historicalDiff, setHistoricalDiff] = useState<{ path: string; oldPath?: string; status: CommitFile["status"]; oldContent: string; newContent: string; loading: boolean; error: string | null } | null>(null);
    const historyCache = useRef<Map<string, { commits: HistoryCommit[]; time: number }>>(new Map());
    const fileContentCache = useRef<Map<string, string>>(new Map()); // key `${sha}:${path}` -> content
    const [restoreConfirm, setRestoreConfirm] = useState<{ type: "commit" | "file"; file?: CommitFile } | null>(null);

    // CRUD modals
    const [renameDoc, setRenameDoc] = useState<Note | null>(null);
    const [moveDoc, setMoveDoc] = useState<Note | null>(null);
    const [deleteDoc, setDeleteDoc] = useState<Note | null>(null);
    const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
    const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const AUTO_COMMIT_DELAY = 2500;
    const autoCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleCommitRef = useRef<((msg: string, isAuto?: boolean) => Promise<void>) | null>(null);
    const docFetchControllerRef = useRef<AbortController | null>(null);

    const allDocs = useMemo(() => flattenNotes(folders, rootDocuments), [folders, rootDocuments]);
    const allPaths = useMemo(() => new Set(allDocs.map((d) => d.path)), [allDocs]);

    const changes = useMemo<WorkspaceChange[]>(() => {
        // Only track changes when a GitHub repo is connected (snapshot non-empty or repo selected)
        if (!selectedRepository && originalSnapshot.length === 0) return [];
        return getWorkspaceChanges(originalSnapshot, folders, rootDocuments);
    }, [originalSnapshot, folders, rootDocuments, selectedRepository]);

    // Keep ref in sync for stable comparison in callbacks without re-renders
    useEffect(() => {
        lastSavedContentRef.current = lastSavedContent;
    }, [lastSavedContent]);

    useEffect(() => {
        let cancelled = false;

        async function loadSession() {
            try {
                const response = await fetch("/api/github/session");
                const data = (await response.json()) as unknown;

                if (!isSessionResponse(data) || !data.connected || cancelled) {
                    if (isSessionResponse(data) && !cancelled) {
                        setGithubInstallUrl(data.installUrl ?? null);
                    }
                    return;
                }

                setAccount(data.account);
                setGithubInstallUrl(data.installUrl);
                setFolders([]);
                setRootDocuments([]);
                setRepositoriesLoading(true);
                setGithubError(null);

                const repositoriesResponse = await fetch("/api/github/repositories");
                const repositoriesData = (await repositoriesResponse.json()) as unknown;

                if (!repositoriesResponse.ok || !isRepositoriesResponse(repositoriesData)) {
                    throw new Error("Unable to load repositories.");
                }

                if (!cancelled) {
                    setRepositories(repositoriesData.repositories);

                    // Restore last selected repo (cross-device via Supabase, fallback localStorage)
                    try {
                        const prefRes = await fetch("/api/github/selected-repo");
                        const prefData = (await prefRes.json()) as { preference?: { owner: string; repo: string; branch: string } | null; configured?: boolean };
                        const pref = prefData.preference;
                        // Fallback to localStorage when Supabase not configured
                        const localPref = (() => {
                            try {
                                const raw = localStorage.getItem("gitnote:selectedRepo");
                                return raw ? (JSON.parse(raw) as { owner: string; repo: string; branch: string }) : null;
                            } catch { return null; }
                        })();
                        const target = pref ?? localPref;
                        if (target) {
                            const match = repositoriesData.repositories.find((r: GitHubRepository) => r.owner === target.owner && r.name === target.repo);
                            if (match && !cancelled) {
                                // Defer tree load to next tick to avoid setState during current effect
                                setTimeout(() => void handleSelectRepository(match), 0);
                            }
                        }
                    } catch { /* ignore preference load errors */ }
                }
            } catch {
                if (!cancelled) {
                    setGithubError("Unable to load repositories.");
                }
            } finally {
                if (!cancelled) {
                    setRepositoriesLoading(false);
                }
            }
        }

        void loadSession();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (account) {
            return;
        }
        const id = setTimeout(() => {
            try {
                localStorage.setItem("gitnote-folders", JSON.stringify(folders));
            } catch {}
        }, 400);
        return () => clearTimeout(id);
    }, [account, folders]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            const active = document.activeElement as HTMLElement | null;
            const isEditable = !!active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable || !!active.closest('[contenteditable="true"]'));
            if (e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
            else if (e.key.toLowerCase() === "n" && e.shiftKey) {
                if (isEditable) return;
                e.preventDefault(); setNewFolderOpen(true); setNewFolderInitialParent(null);
            }
            else if (e.key.toLowerCase() === "n") {
                if (isEditable) return;
                e.preventDefault(); setNewDocOpen(true); setNewDocInitialFolder(null);
            }
            else if (e.key.toLowerCase() === "b") {
                if (isEditable) return;
                e.preventDefault(); setSidebarOpen((v) => !v);
            }
            else if (e.key === ".") {
                if (isEditable) return;
                e.preventDefault(); setPanelOpen((v) => !v);
            }
            else if (e.key.toLowerCase() === "l" && e.shiftKey) {
                if (isEditable) return;
                e.preventDefault(); setEditorTheme((t) => (t === "light" ? "dark" : "light"));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // beforeunload guard for unsaved changes
    useEffect(() => {
        const hasUnsaved = saveStatus === "unsaved" || saveStatus === "error" || changes.length > 0;
        if (!hasUnsaved) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [saveStatus, changes]);


    function handleContentChange(content: string) {
        if (!selectedDocument) {
            return;
        }

        const updatedDocument = {
            ...selectedDocument,
            content,
        };

        setSelectedDocument(updatedDocument);

        // Local docs: persist in folders (no GitHub save)
        if (!selectedDocument.source) {
            setFolders((currentFolders) => updateDocumentInFolders(currentFolders, updatedDocument));
            // Also update root docs if needed
            setRootDocuments((prev) => prev.map((d) => d.id === updatedDocument.id ? updatedDocument : d));
            return;
        }

        // GitHub docs: track unsaved vs saved — also update tree content so search reflects? Keep content in tree.
        setFolders((prev) => updateDocumentInFolders(prev, updatedDocument));
        setRootDocuments((prev) => prev.map((d) => d.id === updatedDocument.id ? updatedDocument : d));
        if (content === lastSavedContentRef.current) {
            setSaveStatus("saved");
        } else {
            setSaveStatus("unsaved");
        }
    }

    function handleNameChange(name: string) {
        if (!selectedDocument) {
            return;
        }

        // Empty title guard — keep at least "Untitled"
        const raw = name;
        if (!raw.trim()) {
            const updatedDocument = { ...selectedDocument, name: raw };
            setSelectedDocument(updatedDocument);
            return;
        }

        // For GitHub docs, treat title as filename: rename file path accordingly
        const parentPath = selectedDocument.path.includes("/") ? selectedDocument.path.split("/").slice(0, -1).join("/") : null;
        const sanitizedFileName = (() => {
            let t = raw.trim();
            if (!t.toLowerCase().endsWith(".md")) t += ".md";
            return t;
        })();
        const newPath = parentPath ? `${parentPath}/${sanitizedFileName}` : sanitizedFileName;
        const displayName = sanitizedFileName.replace(/\.md$/i, "");

        // Avoid no-op (compare trimmed display name)
        if (newPath === selectedDocument.path && displayName === selectedDocument.name) {
            const updatedDocument = { ...selectedDocument, name: raw };
            setSelectedDocument(updatedDocument);
            return;
        }

        // Duplicate check using memoized allPaths
        if (allPaths.has(newPath) && newPath !== selectedDocument.path) {
            toast.error("A document with that name already exists in this folder");
            return;
        }

        // Validate (basic)
        if (sanitizedFileName.length > 120) {
            toast.error("File name too long (max 120)");
            return;
        }

        const updatedDocument: Note = {
            ...selectedDocument,
            name: displayName,
            path: newPath,
        };

        setSelectedDocument(updatedDocument);

        // Persist in tree so WorkspaceChanges detects "renamed"
        setFolders((prev) => updateDocumentInFolders(prev, updatedDocument));
        setRootDocuments((prev) => prev.map((d) => (d.id === updatedDocument.id ? updatedDocument : d)));

        // Mark for auto-commit (GitHub) or just local
        if (updatedDocument.source) {
            // GitHub: any title rename is a file rename → needs commit
            if (newPath !== selectedDocument.path) {
                setSaveStatus("unsaved");
            }
        } else {
            // Local docs: keep saved (no GitHub commit) but title is now persisted locally
            setSaveStatus("saved");
        }
    }

    function handleCreateDocument(note: Note) {
        const path = note.path;
        const folderPath = path.includes("/") ? path.split("/").slice(0, -1).join("/") : null;

        // Local-only creation — produces WorkspaceChange (Added). Commit happens via Changes panel.
        if (!folderPath) {
            setRootDocuments((prev) => [...prev, note].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
            setFolders((prev) => {
                const found = insertIntoFolderTree(prev, folderPath, note);
                if (found) return found;
                const newFolder: Folder = { id: crypto.randomUUID(), name: folderPath.split("/").pop() ?? folderPath, documents: [note], folders: [] };
                return [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name));
            });
        }
        setSelectedDocument(note);
        setLastSavedContent(note.content);
        setSaveStatus("saved");
        setViewMode("editor");
        toast.success("Document created", { description: note.path });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function replaceInTree(folders: Folder[], oldId: string, newNote: Note): Folder[] {
        return folders.map((f) => ({
            ...f,
            documents: f.documents.map((d) => (d.id === oldId ? newNote : d)),
            folders: f.folders ? replaceInTree(f.folders, oldId, newNote) : undefined,
        }));
    }

    function handleCreateFolder(name: string, parentPath: string | null) {
        const result = createFolder(folders, parentPath, name);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        setFolders(result.folders);
        setNewFolderOpen(false);
        toast.success("Folder created", { description: parentPath ? `${parentPath}/${name}` : name });
    }

    function handleRenameDocument(newName: string) {
        if (!renameDoc) return;
        const result = renameDocumentHelper(folders, rootDocuments, renameDoc.id, newName);
        if (result.error || !result.renamed) {
            toast.error(result.error ?? "Unable to rename document");
            return;
        }
        setFolders(result.folders);
        setRootDocuments(result.rootDocs);
        if (selectedDocument?.id === result.renamed.id) {
            setSelectedDocument(result.renamed);
        }
        setRenameDoc(null);
        toast.success("Document renamed", { description: result.renamed.path });
    }

    function handleDeleteDocument() {
        if (!deleteDoc) return;
        const { folders: nextFolders, rootDocs: nextRoot, removed } = removeDocument(folders, rootDocuments, deleteDoc.id);
        if (!removed) {
            toast.error("Unable to delete document");
            setDeleteDoc(null);
            return;
        }
        setFolders(nextFolders);
        setRootDocuments(nextRoot);
        // handle selection
        if (selectedDocument?.id === deleteDoc.id) {
            const remaining = flattenNotes(nextFolders, nextRoot);
            if (remaining.length > 0) {
                const next = remaining[0];
                // load content if needed via handleSelectDocument flow but for local we can set directly; for GitHub we need to fetch
                if (!next.source) {
                    setSelectedDocument(next);
                    setLastSavedContent(next.content);
                    setSaveStatus("saved");
                } else {
                    // Use handleSelectDocument to fetch content
                    void handleSelectDocument(next);
                }
            } else {
                setSelectedDocument(null);
                setLastSavedContent("");
                setSaveStatus("saved");
            }
        }
        setDeleteDoc(null);
        toast.success("Document deleted");
    }

    function handleMoveDocument(dest: string | null) {
        if (!moveDoc) return;
        const result = moveDocumentHelper(folders, rootDocuments, moveDoc.id, dest);
        if (!result.moved) {
            toast.error("Unable to move document");
            return;
        }
        setFolders(result.folders);
        setRootDocuments(result.rootDocs);
        if (selectedDocument?.id === result.moved.id) {
            setSelectedDocument(result.moved);
        }
        setMoveDoc(null);
        toast.success("Document moved", { description: result.moved.path });
    }

    function handleRenameFolder(newName: string) {
        if (!renameFolderTarget) return;
        const result = renameFolderHelper(folders, renameFolderTarget.id, newName);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        setFolders(result.folders);
        // Update selectedDocument if it was inside renamed folder
        if (selectedDocument && result.oldPath && result.newPath) {
            if (selectedDocument.path === result.oldPath || selectedDocument.path.startsWith(result.oldPath + "/")) {
                const all = flattenNotes(result.folders, rootDocuments);
                const found = all.find((d) => d.id === selectedDocument.id);
                if (found) setSelectedDocument(found);
            }
        }
        setRenameFolderTarget(null);
        toast.success("Folder renamed", { description: newName });
    }

    function handleDeleteFolder() {
        if (!deleteFolderTarget) return;
        const targetId = deleteFolderTarget.id;
        const folderPath = getFolderPathById(folders, targetId);
        const { folders: nextFolders, removed } = deleteFolderHelper(folders, targetId);
        if (!removed) {
            toast.error("Unable to delete folder");
            setDeleteFolderTarget(null);
            return;
        }
        setFolders(nextFolders);
        // If selectedDocument was inside deleted folder, clear selection
        if (selectedDocument && folderPath && (selectedDocument.path === folderPath || selectedDocument.path.startsWith(folderPath + "/"))) {
            const remaining = flattenNotes(nextFolders, rootDocuments);
            if (remaining.length > 0) {
                const next = remaining[0];
                if (!next.source) {
                    setSelectedDocument(next);
                    setLastSavedContent(next.content);
                    setSaveStatus("saved");
                } else {
                    void handleSelectDocument(next);
                }
            } else {
                setSelectedDocument(null);
                setLastSavedContent("");
                setSaveStatus("saved");
            }
        }
        setDeleteFolderTarget(null);
        toast.success("Folder deleted");
    }

    // Save → Commit dialog
    function handleSaveClick() {
        if (!selectedDocument?.source) return;
        if (saveStatus === "saved" || saveStatus === "saving") return;
        // Avoid unnecessary commits
        if (selectedDocument.content === lastSavedContent) {
            setSaveStatus("saved");
            return;
        }
        setCommitError(null);
        setCommitMessage(`Update ${selectedDocument.name}`);
        setCommitDialogOpen(true);
    }

    async function handleCommit(commitMessageParam: string, isAuto = false) {
        const trimmed = commitMessageParam.trim();
        if (!trimmed) {
            if (isAuto) {
                toast.error("Auto-save failed: empty commit message");
                return;
            }
            setCommitError("Commit message is required.");
            return;
        }
        if (saveStatus === "saving") return;
        if (!selectedRepository) {
            const msg = "Select a repository to commit.";
            if (isAuto) { toast.error(msg); return; }
            setCommitError(msg);
            return;
        }
        if (changes.length === 0) {
            // Nothing to commit — maybe single file unsaved not yet in changes due to lazy snapshot?
            // Fall back to previous single-file check
            if (selectedDocument && selectedDocument.content !== lastSavedContent && selectedDocument.source) {
                // single file commit via PUT as before (will be covered by changes normally)
            } else {
                if (!isAuto) setCommitDialogOpen(false);
                setSaveStatus("saved");
                return;
            }
        }

        setSaveStatus("saving");
        setCommitError(null);

        try {
            // Build payload for atomic multi-file commit
            const allCurrentDocs = flattenNotes(folders, rootDocuments);
            const payloadChanges: Array<{ type: "added" | "modified" | "deleted" | "renamed"; path: string; oldPath?: string; content?: string; sha?: string }> = [];
            for (const c of changes) {
                if (c.type === "added") {
                    const doc = allCurrentDocs.find((d) => d.id === c.id);
                    payloadChanges.push({ type: "added", path: c.path, content: doc?.content ?? c.content ?? "" });
                } else if (c.type === "modified") {
                    payloadChanges.push({ type: "modified", path: c.path, content: c.content ?? "", sha: c.source?.sha });
                } else if (c.type === "deleted") {
                    if (!c.source?.sha) throw new Error(`Missing SHA for deleted file ${c.path}. Reload repository.`);
                    payloadChanges.push({ type: "deleted", path: c.path, sha: c.source.sha });
                } else if (c.type === "renamed") {
                    const doc = allCurrentDocs.find((d) => d.id === c.id);
                    const content = doc?.content ?? c.content ?? c.oldContent ?? "";
                    payloadChanges.push({ type: "renamed", path: c.path, oldPath: c.oldPath!, content, sha: c.source?.sha });
                }
            }

            // If changes empty but single file modified (edge), add it
            if (payloadChanges.length === 0 && selectedDocument?.source && selectedDocument.content !== lastSavedContent) {
                payloadChanges.push({ type: "modified", path: selectedDocument.path, content: selectedDocument.content, sha: selectedDocument.source.sha });
            }

            if (payloadChanges.length === 0) throw new Error("No changes to commit.");

            const res = await fetch("/api/github/commit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner: selectedRepository.owner,
                    repo: selectedRepository.name,
                    branch: selectedRepository.defaultBranch,
                    message: trimmed,
                    changes: payloadChanges,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string; commitSha?: string };
            if (!res.ok || !data.commitSha) {
                const friendly =
                    data.error ??
                    (res.status === 409
                        ? "Some files changed on GitHub. Reload the repository before committing again."
                        : res.status === 401 || res.status === 403
                            ? "You don't have permission to commit to this repository."
                            : "Unable to commit changes.");
                throw new Error(friendly);
            }

            // Success: sync snapshot and workspace SHA/paths
            const commitSha = data.commitSha;
            // Update workspace source.path to current path and set sha placeholder (commitSha) for future operations
            // For added files, assign source
            const syncSourceInFolders = (fs: Folder[]): Folder[] =>
                fs.map((f) => ({
                    ...f,
                    documents: f.documents.map((d) => {
                        const isChanged = changes.some((c) => c.id === d.id);
                        if (isChanged && !d.source && selectedRepository) {
                            return { ...d, source: { type: "github" as const, owner: selectedRepository.owner, repo: selectedRepository.name, branch: selectedRepository.defaultBranch, path: d.path, sha: commitSha } };
                        }
                        if (d.source) return { ...d, source: { ...d.source, path: d.path, sha: commitSha } };
                        return d;
                    }),
                    folders: f.folders ? syncSourceInFolders(f.folders) : undefined,
                }));
            setFolders((prev) => syncSourceInFolders(prev));
            setRootDocuments((prev) =>
                prev.map((d) => {
                    const isChanged = changes.some((c) => c.id === d.id);
                    if (isChanged && !d.source && selectedRepository) {
                        return { ...d, source: { type: "github" as const, owner: selectedRepository.owner, repo: selectedRepository.name, branch: selectedRepository.defaultBranch, path: d.path, sha: commitSha } };
                    }
                    if (d.source) return { ...d, source: { ...d.source, path: d.path, sha: commitSha } };
                    return d;
                })
            );
            if (selectedDocument?.source) {
                setSelectedDocument((prev) => (prev && prev.source ? { ...prev, source: { ...prev.source, path: prev.path, sha: commitSha } } : prev));
                setLastSavedContent(selectedDocument.content);
            } else if (selectedDocument) {
                // added doc now has source
                const isAdded = changes.some((c) => c.id === selectedDocument.id && c.type === "added");
                if (isAdded) {
                    setSelectedDocument((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  source: { type: "github", owner: selectedRepository.owner, repo: selectedRepository.name, branch: selectedRepository.defaultBranch, path: prev.path, sha: commitSha },
                              }
                            : prev
                    );
                    if (selectedDocument) setLastSavedContent(selectedDocument.content);
                }
            }

            setOriginalSnapshot(() => {
                // Build from current docs (including added) — deleted already not in allCurrentDocs
                const snap: OriginalSnapshot = allCurrentDocs.map((d) => {
                    const isAdded = changes.some((c) => c.id === d.id && c.type === "added");
                    const source = d.source
                        ? { ...d.source, path: d.path, sha: commitSha }
                        : isAdded && selectedRepository
                            ? { type: "github" as const, owner: selectedRepository.owner, repo: selectedRepository.name, branch: selectedRepository.defaultBranch, path: d.path, sha: commitSha }
                            : undefined;
                    return { id: d.id, path: d.path, name: d.name, content: d.content, source };
                });
                // Note: deleted files not in snap (correct). Renamed files have new path already.
                return snap;
            });

            setSaveStatus("saved");
            setCommitDialogOpen(false);
            setGithubError(null);
            setSelectedChange(null);
            setViewMode("editor");
            const successMsg = isAuto ? `Auto-saved: ${trimmed}` : "Changes committed";
            toast.success(successMsg, { description: `${payloadChanges.length} file(s) — ${trimmed}` });

            // Background refresh to replace placeholder commitSha with real blob SHAs from GitHub
            void (async () => {
                try {
                    const params = new URLSearchParams({ owner: selectedRepository.owner, repo: selectedRepository.name, branch: selectedRepository.defaultBranch });
                    const r = await fetch(`/api/github/tree?${params.toString()}`);
                    const d = (await r.json()) as { tree?: { files: Array<{ path: string; sha: string }> } };
                    if (!r.ok || !d.tree) return;
                    const shaByPath = new Map(d.tree.files.map((f) => [f.path, f.sha] as const));
                    const patchFolders = (fs: Folder[]): Folder[] =>
                        fs.map((f) => ({
                            ...f,
                            documents: f.documents.map((doc) => {
                                const realSha = shaByPath.get(doc.path);
                                if (realSha && doc.source) return { ...doc, source: { ...doc.source, sha: realSha } };
                                return doc;
                            }),
                            folders: f.folders ? patchFolders(f.folders) : undefined,
                        }));
                    setFolders((prev) => patchFolders(prev));
                    setRootDocuments((prev) => prev.map((doc) => {
                        const realSha = shaByPath.get(doc.path);
                        return realSha && doc.source ? { ...doc, source: { ...doc.source, sha: realSha } } : doc;
                    }));
                    setOriginalSnapshot((prev) => prev.map((doc) => {
                        const realSha = shaByPath.get(doc.path);
                        return realSha && doc.source ? { ...doc, source: { ...doc.source, sha: realSha } } : doc;
                    }));
                    setSelectedDocument((prev) => {
                        if (!prev?.source) return prev;
                        const realSha = shaByPath.get(prev.path);
                        return realSha ? { ...prev, source: { ...prev.source, sha: realSha } } : prev;
                    });
                } catch {
                    // ignore background refresh errors
                }
            })();
        } catch (err) {
            console.error("Commit failed:", err);
            const message = err instanceof Error ? err.message : "Unable to commit changes.";
            const friendly = message.includes("Failed to fetch") || message.includes("NetworkError") ? "Unable to connect to GitHub." : message;
            if (isAuto) {
                toast.error(friendly);
            } else {
                if (friendly === "Unable to connect to GitHub.") setCommitError(friendly);
                else setCommitError(friendly);
            }
            setSaveStatus("error");
        }
    }

    // Keep ref in sync for auto-commit debounce (avoids stale closure)
    useEffect(() => {
        handleCommitRef.current = handleCommit;
    });

    // Auto-commit debounce 2.5s for title + content (when GitHub repo selected)
    useEffect(() => {
        if (!selectedRepository || !selectedDocument?.source) return;
        if (saveStatus === "saving") return;
        if (commitDialogOpen) return;
        const hasPending = changes.length > 0 || saveStatus === "unsaved" || saveStatus === "error";
        if (!hasPending) return;
        // Don't auto-commit while still typing rapidly: debounce
        if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
        autoCommitTimerRef.current = setTimeout(() => {
            const commitRef = handleCommitRef.current;
            if (!commitRef) return;
            // Build concise auto message
            let msg: string;
            if (changes.length === 1) {
                const c = changes[0];
                if (c.type === "renamed") msg = `Rename ${c.oldPath} → ${c.path}`;
                else if (c.type === "added") msg = `Add ${c.path}`;
                else if (c.type === "deleted") msg = `Remove ${c.path}`;
                else msg = `Update ${c.path}`;
            } else if (changes.length > 1) {
                msg = `Auto save: ${changes.length} files`;
            } else {
                msg = `Update ${selectedDocument.name}`;
            }
            void commitRef(msg, true);
        }, AUTO_COMMIT_DELAY);
        return () => {
            if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
        };
        // Intentionally watch changes identity, saveStatus, doc id/name, repo, dialog
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changes, saveStatus, selectedDocument?.id, selectedDocument?.name, selectedDocument?.content, selectedRepository, commitDialogOpen]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function updateShaInFolders(folders: Folder[], docId: string, newSha: string, newPath: string): Folder[] {
        return folders.map((f) => ({
            ...f,
            documents: f.documents.map((d) => (d.id === docId && d.source ? { ...d, source: { ...d.source, sha: newSha, path: newPath } } : d)),
            folders: f.folders ? updateShaInFolders(f.folders, docId, newSha, newPath) : undefined,
        }));
    }

    async function handleSelectRepository(repository: GitHubRepository) {
        setSelectedRepository(repository);
        setSelectedDocument(null);
        setFolders([]);
        setRootDocuments([]);
        setOriginalSnapshot([]);
        setSelectedChange(null);
        setViewMode("editor");
        setOriginalLoadingIds(new Set());
        setOriginalErrors(new Map());
        originalFetchingRef.current.clear();
        setHistoryCommits([]);
        setFileHistoryCommits([]);
        setFileHistoryLoading(false);
        setFileHistoryError(null);
        setHistoryLoading(false);
        setHistoryFilterPath(null);
        setSelectedHistorySha(null);
        setCommitDetails(null);
        setSelectedHistoryFile(null);
        setHistoricalDiff(null);
        historyCache.current.clear();
        commitDetailsCache.current.clear();
        fileContentCache.current.clear();
        setTreeLoading(true);
        setGithubError(null);
        setSaveStatus("saved");
        setLastSavedContent("");
        // Persist selection cross-device (Supabase) + fallback localStorage
        try { localStorage.setItem("gitnote:selectedRepo", JSON.stringify({ owner: repository.owner, repo: repository.name, branch: repository.defaultBranch })); } catch {}
        void fetch("/api/github/selected-repo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner: repository.owner, repo: repository.name, branch: repository.defaultBranch }) }).catch(() => {});

        const params = new URLSearchParams({
            owner: repository.owner,
            repo: repository.name,
            branch: repository.defaultBranch,
        });

        try {
            const response = await fetch(`/api/github/tree?${params.toString()}`);
            const data = (await response.json()) as unknown;

            if (!response.ok || !isTreeResponse(data)) {
                throw new Error("Unable to load repository files.");
            }

            const documents = buildRepositoryDocuments(repository, data.tree);

            setFolders(documents.folders);
            setRootDocuments(documents.documents);
            // Create original snapshot — preserve empty content for lazy-loaded files; fill on file load
            const snapshot: OriginalSnapshot = [];
            const collect = (folders: Folder[], roots: Note[]) => {
                const all = flattenNotes(folders, roots);
                for (const doc of all) {
                    snapshot.push({ id: doc.id, path: doc.path, name: doc.name, content: doc.content, source: doc.source ? { ...doc.source } : undefined });
                }
            };
            collect(documents.folders, documents.documents);
            setOriginalSnapshot(snapshot);
        } catch {
            setGithubError("Unable to load repository files.");
        } finally {
            setTreeLoading(false);
        }
    }

    async function handleSelectDocument(document: Note) {
        setViewMode("editor");
        if (!document.source) {
            // Cancel any pending GitHub fetch
            docFetchControllerRef.current?.abort();
            setDocumentLoading(false);
            setSelectedDocument(document);
            setLastSavedContent(document.content);
            setSaveStatus("saved");
            setCommitDialogOpen(false);
            setCommitError(null);
            return;
        }

        // Abort previous fetch to avoid stale overwrite
        docFetchControllerRef.current?.abort();
        const controller = new AbortController();
        docFetchControllerRef.current = controller;

        setDocumentLoading(true);
        setGithubError(null);
        setSaveStatus("saved");

        const params = new URLSearchParams({
            owner: document.source.owner,
            repo: document.source.repo,
            path: document.source.path,
            ref: document.source.branch,
        });

        try {
            const response = await fetch(`/api/github/file?${params.toString()}`, { signal: controller.signal });
            const data = (await response.json()) as unknown;

            if (!response.ok || !isFileResponse(data)) {
                throw new Error("Unable to load document.");
            }

            const file = data.file;
            setLastSavedContent(file.content);
            setSaveStatus("saved");
            setCommitDialogOpen(false);
            setCommitError(null);
            const updatedDoc: Note = {
                ...document,
                name: file.name,
                content: file.content,
                source: {
                    ...document.source,
                    sha: file.sha,
                },
            };
            setSelectedDocument(updatedDoc);
            // Update tree with loaded content
            setFolders((prev) => updateDocumentInFolders(prev, updatedDoc));
            setRootDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
            // Populate original snapshot if empty (lazy load). Preserve snapshot for diff comparison.
            setOriginalSnapshot((prev) => {
                const idx = prev.findIndex((d) => d.id === document.id);
                if (idx === -1) return prev;
                if (prev[idx].content !== "" && prev[idx].content !== undefined) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], content: file.content, source: { ...next[idx].source!, sha: file.sha } as Note["source"] };
                return next;
            });
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
            setGithubError("Unable to load document.");
        } finally {
            if (docFetchControllerRef.current === controller) setDocumentLoading(false);
        }
    }

    async function ensureOriginalContent(change: WorkspaceChange) {
        if (change.type === "added") return;
        const snapshotDoc = originalSnapshot.find((d) => d.id === change.id);
        // If snapshot already has content, nothing to do (oldContent will be populated via changes)
        // Need to fetch only if snapshot content is empty string (lazy not loaded) and no error
        // We treat empty string as "not yet loaded" for lazy; for truly empty files this will fetch once and cache "" again which is fine.
        const alreadyLoaded = snapshotDoc && snapshotDoc.content !== "" && (change.oldContent !== undefined && change.oldContent !== "");
        if (alreadyLoaded) return;
        // Avoid duplicate fetches
        if (originalFetchingRef.current.has(change.id)) return;
        // Need snapshot metadata to fetch
        const source = snapshotDoc?.source ?? change.source;
        if (!source) return;
        // If change.oldContent is already non-empty, snapshot already has it; skip
        if (change.oldContent && change.oldContent !== "") return;
        // If snapshotDoc content is non-empty but change.oldContent empty? shouldn't happen
        if (snapshotDoc && snapshotDoc.content !== "" && snapshotDoc.content !== undefined) return;

        originalFetchingRef.current.add(change.id);
        setOriginalLoadingIds((prev) => new Set(prev).add(change.id));
        setOriginalErrors((prev) => {
            const m = new Map(prev);
            m.delete(change.id);
            return m;
        });
        try {
            const githubPath = source.path;
            const params = new URLSearchParams({ owner: source.owner, repo: source.repo, path: githubPath, ref: source.branch });
            const res = await fetch(`/api/github/file?${params.toString()}`);
            const data = (await res.json()) as unknown as { file?: { content: string; sha: string }; error?: string };
            if (!res.ok || !data.file) throw new Error(data.error ?? "Unable to load original version.");
            const fileContent = data.file.content;
            const fileSha = data.file.sha;
            setOriginalSnapshot((prev) =>
                prev.map((d) => (d.id === change.id ? { ...d, content: fileContent, source: d.source ? { ...d.source, sha: fileSha } : d.source } : d))
            );
            setSelectedChange((prev) => (prev && prev.id === change.id ? { ...prev, oldContent: fileContent } : prev));
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unable to load original version.";
            setOriginalErrors((prev) => {
                const m = new Map(prev);
                m.set(change.id, msg);
                return m;
            });
        } finally {
            originalFetchingRef.current.delete(change.id);
            setOriginalLoadingIds((prev) => {
                const s = new Set(prev);
                s.delete(change.id);
                return s;
            });
        }
    }

    function handleSelectChange(change: WorkspaceChange) {
        setSelectedChange(change);
        setViewMode("diff");
        void ensureOriginalContent(change);
    }

    function handleRetryOriginal(change: WorkspaceChange) {
        void ensureOriginalContent(change);
    }

    // History — supports repo history (path=null) and file history (path="docs/API.md")
    async function fetchHistory(pathOverride?: string | null | boolean, force = false) {
        if (!selectedRepository) return;
        // handle legacy call fetchHistory(true) where first arg is boolean force
        let effectivePath: string | null;
        let effectiveForce = force;
        if (typeof pathOverride === "boolean") {
            effectiveForce = pathOverride;
            effectivePath = historyFilterPath;
        } else {
            effectivePath = pathOverride !== undefined ? pathOverride : historyFilterPath;
        }
        const key = `${selectedRepository.owner}/${selectedRepository.name}/${selectedRepository.defaultBranch}:${effectivePath ?? ""}`;
        const isFileHistory = !!effectivePath;
        if (!effectiveForce && historyCache.current.has(key)) {
            const cached = historyCache.current.get(key)!;
            if (Date.now() - cached.time < 60000) {
                if (isFileHistory) setFileHistoryCommits(cached.commits);
                else setHistoryCommits(cached.commits);
                return;
            }
        }
        if (isFileHistory) {
            setFileHistoryLoading(true);
            setFileHistoryError(null);
        } else {
            setHistoryLoading(true);
            setHistoryError(null);
        }
        try {
            const params = new URLSearchParams({ owner: selectedRepository.owner, repo: selectedRepository.name, branch: selectedRepository.defaultBranch, perPage: "30" });
            if (effectivePath) params.set("path", effectivePath);
            const res = await fetch(`/api/github/history?${params.toString()}`);
            const data = (await res.json()) as { commits?: HistoryCommit[]; error?: string };
            if (!res.ok || !data.commits) throw new Error(data.error ?? "Unable to load commit history.");
            if (isFileHistory) setFileHistoryCommits(data.commits);
            else setHistoryCommits(data.commits);
            historyCache.current.set(key, { commits: data.commits, time: Date.now() });
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unable to load commit history.";
            if (isFileHistory) setFileHistoryError(msg);
            else setHistoryError(msg);
        } finally {
            if (isFileHistory) setFileHistoryLoading(false);
            else setHistoryLoading(false);
        }
    }

    async function handleSelectHistoryCommit(sha: string) {
        setSelectedHistorySha(sha);
        setSelectedHistoryFile(null);
        setHistoricalDiff(null);
        setViewMode("commit");
        // check cache
        if (commitDetailsCache.current.has(sha)) {
            setCommitDetails(commitDetailsCache.current.get(sha)!);
            return;
        }
        if (!selectedRepository) return;
        setCommitDetailsLoading(true);
        setCommitDetailsError(null);
        setCommitDetails(null);
        try {
            const params = new URLSearchParams({ owner: selectedRepository.owner, repo: selectedRepository.name, sha });
            const res = await fetch(`/api/github/commit?${params.toString()}`);
            const data = (await res.json()) as { commit?: CommitDetails; error?: string };
            if (!res.ok || !data.commit) throw new Error(data.error ?? "Unable to load commit details.");
            commitDetailsCache.current.set(sha, data.commit);
            setCommitDetails(data.commit);
        } catch (e) {
            setCommitDetailsError(e instanceof Error ? e.message : "Unable to load commit details.");
        } finally {
            setCommitDetailsLoading(false);
        }
    }

    async function fetchFileAtRef(path: string, ref: string): Promise<string> {
        const cacheKey = `${ref}:${path}`;
        if (fileContentCache.current.has(cacheKey)) return fileContentCache.current.get(cacheKey)!;
        if (!selectedRepository) throw new Error("No repository");
        const params = new URLSearchParams({ owner: selectedRepository.owner, repo: selectedRepository.name, path, ref });
        const res = await fetch(`/api/github/file?${params.toString()}`);
        const data = (await res.json()) as { file?: { content: string }; error?: string };
        if (!res.ok || !data.file) throw new Error(data.error ?? "Unable to load file.");
        fileContentCache.current.set(cacheKey, data.file.content);
        return data.file.content;
    }

    async function handleSelectHistoryFile(file: CommitFile) {
        if (!commitDetails || !selectedRepository) return;
        setSelectedHistoryFile(file);
        setViewMode("historyDiff");
        const parentSha = commitDetails.parentSha;
        const commitSha = commitDetails.sha;
        setHistoricalDiff({ path: file.path, oldPath: file.previousPath, status: file.status, oldContent: "", newContent: "", loading: true, error: null });
        try {
            let oldContent = "";
            let newContent = "";
            if (file.status === "added") {
                newContent = await fetchFileAtRef(file.path, commitSha);
                oldContent = "";
            } else if (file.status === "removed") {
                if (parentSha) oldContent = await fetchFileAtRef(file.path, parentSha);
                newContent = "";
            } else if (file.status === "renamed" && file.previousPath) {
                if (parentSha) oldContent = await fetchFileAtRef(file.previousPath, parentSha).catch(() => "");
                newContent = await fetchFileAtRef(file.path, commitSha);
            } else {
                // modified
                if (parentSha) oldContent = await fetchFileAtRef(file.path, parentSha).catch(() => "");
                newContent = await fetchFileAtRef(file.path, commitSha);
            }
            setHistoricalDiff({ path: file.path, oldPath: file.previousPath, status: file.status, oldContent, newContent, loading: false, error: null });
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unable to load file contents.";
            setHistoricalDiff((prev) => (prev ? { ...prev, loading: false, error: msg } : null));
        }
    }

    function handleOpenHistory() {
        if (!selectedRepository) {
            toast.error("Select a repository to view history");
            return;
        }
        setViewMode("history");
        if (selectedDocument) {
            const p = selectedDocument.path;
            setHistoryFilterPath(p);
            void fetchHistory(p);
        } else {
            // no file selected, show placeholder - still fetch file history will be empty
            // keep filter null but main view will show select file message
        }
    }

    function handleToggleHistory() {
        if (viewMode === "history" || viewMode === "commit" || viewMode === "historyDiff") {
            setViewMode("editor");
        } else {
            handleOpenHistory();
        }
    }

    // Auto-fetch file history for sidebar/main when document selected (file history only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (selectedDocument && selectedRepository && selectedDocument.path) {
            void fetchHistory(selectedDocument.path);
        }
    }, [selectedDocument?.path, selectedRepository?.fullName]);

    async function handleRestoreCommit() {
        if (!commitDetails || !selectedRepository) return;
        // confirm already done via restoreConfirm
        setRestoreConfirm(null);
        try {
            // Fetch full tree at commit
            const params = new URLSearchParams({ owner: selectedRepository.owner, repo: selectedRepository.name, branch: commitDetails.sha });
            const res = await fetch(`/api/github/tree?${params.toString()}`);
            const data = (await res.json()) as { tree?: { files: Array<{ path: string; sha: string }>; folders: string[] }; error?: string };
            if (!res.ok || !data.tree) throw new Error(data.error ?? "Unable to load commit tree.");
            const files = data.tree.files;
            // Fetch contents for each markdown file (limit parallel)
            const contents: Array<{ path: string; content: string }> = [];
            // fetch in batches of 5 to avoid rate limit
            for (let i = 0; i < files.length; i += 5) {
                const batch = files.slice(i, i + 5);
                const batchContents = await Promise.all(
                    batch.map(async (f) => {
                        try {
                            const c = await fetchFileAtRef(f.path, commitDetails.sha);
                            return { path: f.path, content: c };
                        } catch {
                            return { path: f.path, content: "" };
                        }
                    })
                );
                contents.push(...batchContents);
            }
            // Build new workspace from commit contents
            const docs: Note[] = contents.map((c) => ({
                id: `github-file:${selectedRepository.fullName}:${c.path}`,
                name: c.path.split("/").pop() ?? c.path,
                path: c.path,
                content: c.content,
            }));
            const folderMap = new Map<string, Folder>();
            for (const folderPath of data.tree.folders) {
                folderMap.set(folderPath, { id: `github-folder:${selectedRepository.fullName}:${folderPath}`, name: folderPath.split("/").pop() ?? folderPath, documents: [], folders: [] });
            }
            const topLevel: Folder[] = [];
            for (const [fp, folder] of folderMap) {
                const parentPath = fp.includes("/") ? fp.split("/").slice(0, -1).join("/") : null;
                if (!parentPath) topLevel.push(folder);
                else {
                    const parent = folderMap.get(parentPath);
                    if (parent) parent.folders = [...(parent.folders ?? []), folder];
                }
            }
            // Distribute docs
            const rootDocs: Note[] = [];
            for (const doc of docs) {
                const parentPath = doc.path.includes("/") ? doc.path.split("/").slice(0, -1).join("/") : null;
                if (!parentPath) rootDocs.push(doc);
                else {
                    const parent = folderMap.get(parentPath);
                    if (parent) parent.documents.push(doc);
                    else rootDocs.push(doc); // fallback
                }
            }
            // Sort
            const sortFolders = (fs: Folder[]): Folder[] =>
                fs
                    .map((f) => ({ ...f, documents: [...f.documents].sort((a, b) => a.name.localeCompare(b.name)), folders: f.folders ? sortFolders(f.folders) : [] }))
                    .sort((a, b) => a.name.localeCompare(b.name));
            const newFolders = sortFolders(topLevel);
            const newRoot = rootDocs.sort((a, b) => a.name.localeCompare(b.name));
            setFolders(newFolders);
            setRootDocuments(newRoot);
            // Keep snapshot unchanged (represents HEAD) -> changes will now reflect diff to restored state
            // Update selectedDocument if it was deleted -> pick first doc
            if (selectedDocument) {
                const all = [...newRoot, ...flattenNotes(newFolders, [])];
                const stillExists = all.find((d) => d.id === selectedDocument.id);
                if (!stillExists) {
                    if (all.length > 0) setSelectedDocument(all[0]);
                    else setSelectedDocument(null);
                } else {
                    const updated = all.find((d) => d.id === selectedDocument.id);
                    if (updated) setSelectedDocument(updated);
                }
            }
            setViewMode("editor");
            setSelectedHistoryFile(null);
            setHistoricalDiff(null);
            toast.success("Workspace restored from commit", { description: commitDetails.sha.slice(0, 7) });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Unable to restore commit");
        }
    }

    async function handleRestoreFile(file: CommitFile) {
        if (!selectedRepository || !commitDetails) return;
        setRestoreConfirm(null);
        try {
            let content = "";
            if (file.status !== "removed") {
                content = await fetchFileAtRef(file.path, commitDetails.sha);
            }
            const isRemoved = file.status === "removed";
            const targetPath = file.path;
            const previousPath = file.previousPath;

            if (isRemoved) {
                // Delete file at targetPath from workspace if exists
                const all = flattenNotes(folders, rootDocuments);
                const existing = all.find((d) => d.path === targetPath);
                if (existing) {
                    const { folders: nf, rootDocs: nr } = removeDocument(folders, rootDocuments, existing.id);
                    setFolders(nf);
                    setRootDocuments(nr);
                    if (selectedDocument?.id === existing.id) {
                        const remaining = flattenNotes(nf, nr);
                        setSelectedDocument(remaining[0] ?? null);
                    }
                }
                toast.success("File removed from workspace", { description: targetPath });
                return;
            }

            // For renamed, also remove previousPath if exists and different
            if (file.status === "renamed" && previousPath && previousPath !== targetPath) {
                const all = flattenNotes(folders, rootDocuments);
                const prev = all.find((d) => d.path === previousPath);
                if (prev) {
                    const { folders: nf, rootDocs: nr } = removeDocument(folders, rootDocuments, prev.id);
                    setFolders(nf);
                    setRootDocuments(nr);
                }
            }

            // Upsert file at targetPath with historical content
            const allNow = flattenNotes(folders, rootDocuments);
            const existing = allNow.find((d) => d.path === targetPath);
            const note: Note = {
                id: `github-file:${selectedRepository.fullName}:${targetPath}`,
                name: targetPath.split("/").pop() ?? targetPath,
                path: targetPath,
                content,
            };
            if (existing) {
                // update content
                const updated = { ...existing, content, name: note.name };
                setFolders((prev) => updateDocumentInFolders(prev, updated));
                setRootDocuments((prev) => prev.map((d) => (d.id === existing.id ? updated : d)));
                if (selectedDocument?.id === existing.id) setSelectedDocument(updated);
            } else {
                // create
                const folderPath = targetPath.includes("/") ? targetPath.split("/").slice(0, -1).join("/") : null;
                if (!folderPath) {
                    setRootDocuments((prev) => [...prev, note].sort((a, b) => a.name.localeCompare(b.name)));
                } else {
                    setFolders((prev) => {
                        const found = insertIntoFolderTree(prev, folderPath, note);
                        if (found) return found;
                        const newFolder: Folder = { id: `github-folder:${selectedRepository.fullName}:${folderPath}`, name: folderPath.split("/").pop() ?? folderPath, documents: [note], folders: [] };
                        return [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name));
                    });
                }
                setSelectedDocument(note);
            }
            setViewMode("editor");
            toast.success("File restored to workspace", { description: targetPath });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Unable to restore file");
        }
    }

    async function handleLogout() {
        await fetch("/api/github/logout", { method: "POST" });
        try { localStorage.removeItem("gitnote:selectedRepo"); } catch {}
        setAccount(null);
        setRepositories([]);
        setSelectedRepository(null);
        setSelectedDocument(null);
        setRootDocuments([]);
        setFolders(initialFolders);
        setOriginalSnapshot([]);
        setSelectedChange(null);
        setViewMode("editor");
        setOriginalLoadingIds(new Set());
        setOriginalErrors(new Map());
        originalFetchingRef.current.clear();
        setHistoryCommits([]);
        setFileHistoryCommits([]);
        setFileHistoryLoading(false);
        setFileHistoryError(null);
        setHistoryLoading(false);
        setHistoryFilterPath(null);
        setHistoryError(null);
        setSelectedHistorySha(null);
        setCommitDetails(null);
        setSelectedHistoryFile(null);
        setHistoricalDiff(null);
        historyCache.current.clear();
        commitDetailsCache.current.clear();
        fileContentCache.current.clear();
        setGithubError(null);
        setSaveStatus("saved");
        setLastSavedContent("");
    }

    const sidebarStatus = treeLoading
        ? "Loading repository files..."
        : selectedRepository && folders.length === 0 && rootDocuments.length === 0
            ? "No Markdown files found."
            : undefined;

    const workspaceLabel = selectedRepository
        ? selectedRepository.fullName
        : account
            ? "GitHub"
            : "My Workspace";

    const canSave =
        !!selectedDocument?.source &&
        saveStatus !== "saving" &&
        (saveStatus === "unsaved" || saveStatus === "error" || changes.length > 0) &&
        !!selectedDocument;

    const breadcrumbs =
        viewMode === "history"
            ? [workspaceLabel, selectedRepository?.name ?? "History", "History"]
            : viewMode === "commit" && commitDetails
                ? [workspaceLabel, selectedRepository?.name ?? "History", commitDetails.sha.slice(0, 7)]
                : viewMode === "historyDiff" && historicalDiff
                    ? [workspaceLabel, selectedRepository?.name ?? "History", commitDetails?.sha.slice(0, 7) ?? "Commit", historicalDiff.path]
                    : viewMode === "diff" && selectedChange
                        ? [selectedRepository?.name ?? workspaceLabel, selectedChange.path]
                        : selectedDocument
                            ? [selectedRepository?.name ?? workspaceLabel, selectedDocument.name]
                            : selectedRepository
                                ? [workspaceLabel, selectedRepository.name]
                                : [workspaceLabel];

    const gitStatus: "Synced" | "Modified" | "Untracked" = changes.length > 0 || saveStatus === "unsaved" || saveStatus === "error" || saveStatus === "saving" ? "Modified" : "Synced";

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Backdrop for mobile - Word-like overlay */}
            {sidebarOpen && (
                <button
                    aria-label="Close sidebar"
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px] lg:hidden"
                />
            )}
            <aside className={cn("fixed inset-y-0 left-0 z-30 flex h-screen w-[264px] flex-col border-r border-chrome-border bg-chrome shadow-panel transition-transform duration-200 will-change-transform", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                <Sidebar
                    folders={folders}
                    documents={rootDocuments}
                    selectedDocumentId={selectedDocument?.id ?? null}
                    workspaceLabel={workspaceLabel}
                    status={sidebarStatus}
                    repoName={selectedRepository?.name ?? null}
                    repoBranch={selectedRepository?.defaultBranch ?? null}
                    repoStatus={gitStatus}
                    changes={changes}
                    selectedChangeId={selectedChange?.id ?? null}
                    changesCollapsed={changesCollapsed}
                    repoConnected={!!selectedRepository}
                        action={
                            account ? (
                                <button type="button" onClick={handleLogout} className="rounded-md px-2 py-1 text-xs text-chrome-muted hover:bg-chrome-hover hover:text-chrome-foreground">
                                    Logout
                                </button>
                            ) : (
                                <a href="/api/github/login" className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                                    GitHub
                                </a>
                            )
                        }
                        onSelectDocument={(document) => { void handleSelectDocument(document); }}
                        onNewDocument={() => { setNewDocInitialFolder(null); setNewDocOpen(true); }}
                        onNewFolder={(parentPath) => { setNewFolderInitialParent(parentPath); setNewFolderOpen(true); }}
                        onNewDocumentAt={(folderPath) => { setNewDocInitialFolder(folderPath); setNewDocOpen(true); }}
                        onRenameDocument={(doc) => setRenameDoc(doc)}
                        onMoveDocument={(doc) => setMoveDoc(doc)}
                        onDeleteDocument={(doc) => setDeleteDoc(doc)}
                        onRenameFolder={(folder) => setRenameFolderTarget(folder)}
                        onDeleteFolder={(folder) => setDeleteFolderTarget(folder)}
                        onSelectChange={handleSelectChange}
                        onToggleChanges={() => setChangesCollapsed((v) => !v)}
                        historyCommits={historyCommits}
                        selectedHistorySha={selectedHistorySha}
                        historyLoading={historyLoading}
                        historyError={historyError}
                        historyCollapsed={historyCollapsed}
                        fileHistoryCommits={fileHistoryCommits}
                        fileHistoryLoading={fileHistoryLoading}
                        fileHistoryError={fileHistoryError}
                        fileHistoryCollapsed={fileHistoryCollapsed}
                        selectedDocumentPath={selectedDocument?.path ?? null}
                        onSelectHistoryCommit={(sha) => void handleSelectHistoryCommit(sha)}
                        onToggleHistory={() => setHistoryCollapsed((v) => !v)}
                        onRetryHistory={() => void fetchHistory(null, true)}
                        onToggleFileHistory={() => setFileHistoryCollapsed((v) => !v)}
                        onRetryFileHistory={() => selectedDocument && void fetchHistory(selectedDocument.path, true)}
                        onOpenSettings={() => setSettingsOpen(true)}
                    />
            </aside>

            <div className={cn("flex min-w-0 flex-1 flex-col transition-[margin-left] duration-200", sidebarOpen ? "ml-[264px]" : "ml-0")}>
                <TopBar breadcrumbs={breadcrumbs} status={gitStatus} onToggleSidebar={() => setSidebarOpen((v) => !v)} onTogglePanel={() => setPanelOpen((v) => !v)} onSearch={() => setSearchOpen(true)} accountLogin={account?.login ?? null} onToggleHistory={handleToggleHistory} historyActive={viewMode === "history" || viewMode === "commit" || viewMode === "historyDiff"} />

                <div className={cn("flex min-h-0 flex-1", documentLoading ? "bg-background" : selectedDocument || viewMode === "diff" || viewMode === "historyDiff" ? "bg-editor" : viewMode === "history" || viewMode === "commit" ? "bg-chrome" : "bg-background")}>
                    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <div className={cn("flex flex-1 flex-col", selectedDocument || viewMode === "diff" || viewMode === "historyDiff" || viewMode === "commit" ? "overflow-hidden" : "overflow-y-auto")}>
                    {documentLoading ? (
                        <div className="flex flex-1 items-center justify-center bg-background">
                            <LoadingState label="Loading document…" description={selectedDocument ? selectedDocument.path : "Fetching content from GitHub"} />
                        </div>
                    ) : viewMode === "history" ? (
                        <div className="scroll-thin flex-1 overflow-y-auto bg-chrome">
                            <div className="mx-auto max-w-3xl px-6 py-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="font-display text-lg font-semibold">History</h2>
                                    <button type="button" onClick={() => setViewMode("editor")} className="rounded-md border border-chrome-border bg-chrome px-3 py-1 text-xs hover:bg-chrome-hover">Back to editor</button>
                                </div>
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="label-caps text-chrome-muted">File History</span>
                                    {selectedDocument && <span className="font-mono text-xs text-chrome-muted truncate">{selectedDocument.path}</span>}
                                </div>
                                <div className="rounded-xl border border-chrome-border bg-card shadow-panel">
                                    {selectedDocument ? (
                                        <>
                                            <GitHistory
                                                commits={fileHistoryCommits}
                                                selectedSha={selectedHistorySha}
                                                onSelect={(sha) => void handleSelectHistoryCommit(sha)}
                                                loading={fileHistoryLoading}
                                                error={fileHistoryError}
                                                onRetry={() => void fetchHistory(selectedDocument.path, true)}
                                            />
                                            {!fileHistoryLoading && !fileHistoryError && fileHistoryCommits.length === 0 && (
                                                <p className="px-4 pb-3 text-xs text-chrome-muted">No commits yet for this file. It may be new and not yet committed.</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="p-6 text-sm text-chrome-muted text-center">Select a file to see its history.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : viewMode === "commit" ? (
                        <div className="flex flex-1 overflow-hidden">
                            {commitDetails ? (
                                <div className="flex flex-1">
                                    <CommitDetails
                                        commit={commitDetails}
                                        selectedPath={selectedHistoryFile?.path ?? null}
                                        onSelectFile={(f) => void handleSelectHistoryFile(f)}
                                        onRestoreCommit={() => {
                                            if (changes.length > 0) setRestoreConfirm({ type: "commit" });
                                            else void handleRestoreCommit();
                                        }}
                                        onRestoreFile={(f) => {
                                            if (changes.length > 0) setRestoreConfirm({ type: "file", file: f });
                                            else void handleRestoreFile(f);
                                        }}
                                        loading={commitDetailsLoading}
                                        error={commitDetailsError}
                                        onRetry={() => selectedHistorySha && void handleSelectHistoryCommit(selectedHistorySha)}
                                        onBack={() => setViewMode("history")}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-1 items-center justify-center bg-chrome p-8">
                                    {commitDetailsLoading ? (
                                      <LoadingState label="Loading commit details…" />
                                    ) : (
                                      <p className="text-sm text-chrome-muted">{commitDetailsError ?? "Select a commit"}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : viewMode === "historyDiff" && historicalDiff ? (
                        <DiffViewer
                            path={historicalDiff.path}
                            oldPath={historicalDiff.oldPath}
                            type={historicalDiff.status === "added" ? "added" : historicalDiff.status === "removed" ? "deleted" : historicalDiff.status === "renamed" ? "renamed" : "modified"}
                            oldContent={historicalDiff.oldContent}
                            content={historicalDiff.newContent}
                            isModifiedAfterRename={historicalDiff.status === "renamed" && historicalDiff.oldContent !== historicalDiff.newContent}
                            isLoadingOriginal={historicalDiff.loading}
                            originalError={historicalDiff.error}
                            onRetry={() => selectedHistoryFile && void handleSelectHistoryFile(selectedHistoryFile)}
                            onClose={() => setViewMode("commit")}
                            onCommit={undefined}
                        />
                    ) : viewMode === "diff" && selectedChange ? (
                        <DiffViewer
                            path={selectedChange.path}
                            oldPath={selectedChange.oldPath}
                            type={selectedChange.type}
                            oldContent={selectedChange.oldContent}
                            content={selectedChange.content}
                            isModifiedAfterRename={selectedChange.isModifiedAfterRename}
                            isLoadingOriginal={originalLoadingIds.has(selectedChange.id) || (selectedChange.type !== "added" && !selectedChange.oldContent && !originalErrors.has(selectedChange.id) && (originalSnapshot.find((d) => d.id === selectedChange.id)?.content ?? "") === "")}
                            originalError={originalErrors.get(selectedChange.id) ?? null}
                            onRetry={() => handleRetryOriginal(selectedChange)}
                            onClose={() => setViewMode("editor")}
                            onCommit={() => { setCommitMessage(`Update ${selectedChange.path}`); setCommitError(null); setCommitDialogOpen(true); }}
                        />
                    ) : selectedDocument ? (
                        <div className="flex h-full w-full flex-1">
                            <Editor
                                key={selectedDocument.id}
                                title={selectedDocument.name}
                                content={selectedDocument.content}
                                saveStatus={saveStatus}
                                canSave={canSave}
                                theme={editorTheme}
                                onTitleChange={handleNameChange}
                                onChange={handleContentChange}
                                onSave={handleSaveClick}
                                onHeadingsChange={setHeadings}
                            />
                            {saveStatus === "error" && !commitDialogOpen && commitError && (
                                <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-float">
                                    {commitError}
                                </div>
                            )}
                        </div>
                    ) : account ? (
                        selectedRepository ? (
                            treeLoading ? (
                                <div className="flex flex-1 items-center justify-center bg-background">
                                    <LoadingState label="Loading workspace…" description={selectedRepository.fullName} />
                                </div>
                            ) : (
                                <WorkspaceDashboard
                                    repository={selectedRepository}
                                    folders={folders}
                                    rootDocuments={rootDocuments}
                                    changes={changes}
                                    onSelectDocument={(doc) => void handleSelectDocument(doc)}
                                    onNewDocument={() => { setNewDocInitialFolder(null); setNewDocOpen(true); }}
                                    onNewFolder={() => { setNewFolderInitialParent(null); setNewFolderOpen(true); }}
                                    onOpenSettings={() => setSettingsOpen(true)}
                                    onOpenHistory={handleOpenHistory}
                                />
                            )
                        ) : (
                            <div className="scroll-thin flex flex-1 justify-center overflow-y-auto">
                                <GitHubRepositorySelection
                                    account={account}
                                    repositories={repositories}
                                    selectedRepository={selectedRepository}
                                    installUrl={githubInstallUrl}
                                    loading={repositoriesLoading}
                                    error={githubError}
                                    onRetry={() => window.location.reload()}
                                    onSelectRepository={(repository) => { void handleSelectRepository(repository); }}
                                />
                            </div>
                        )
                    ) : (
                        <div className="flex flex-1 items-center justify-center">
                        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
                            <h1 className="font-display text-3xl font-semibold tracking-tight">Good afternoon.</h1>
                            <p className="mt-1.5 text-[14px] text-muted-foreground">Continue where you left off — connect GitHub to sync your Markdown workspace.</p>
                            <div className="mt-8 flex gap-3">
                                <a href="/api/github/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Connect GitHub</a>
                            </div>
                            {githubError && <p className="mt-4 text-sm text-destructive">{githubError}</p>}
                            <div className="mt-12 grid w-full grid-cols-3 gap-3 text-left">
                                <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-panel"><p className="font-display text-xl font-semibold">{folders.length}</p><p className="text-[12px] text-muted-foreground">Folders</p></div>
                                <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-panel"><p className="font-display text-xl font-semibold">{rootDocuments.length + folders.reduce((a,f)=>a+f.documents.length,0)}</p><p className="text-[12px] text-muted-foreground">Documents</p></div>
                                <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-panel"><p className="font-display text-xl font-semibold">1</p><p className="text-[12px] text-muted-foreground">Workspace</p></div>
                            </div>
                        </div>
                        </div>
                    )}
                        </div>
                    </main>
                    {selectedDocument && panelOpen && (
                        <div className="hidden lg:flex">
                            <RightPanel doc={selectedDocument} headings={headings} theme={editorTheme} onToggleTheme={() => setEditorTheme((t) => (t === "light" ? "dark" : "light"))} onClose={() => setPanelOpen(false)} />
                        </div>
                    )}
                </div>
            </div>
            <CommitDialog
                open={commitDialogOpen}
                fileName={selectedChange?.path ?? selectedDocument?.name ?? (changes.length > 0 ? `${changes.length} files` : "")}
                message={commitMessage}
                changes={changes}
                onMessageChange={setCommitMessage}
                saving={saveStatus === "saving"}
                error={commitError}
                onClose={() => { if (saveStatus !== "saving") { setCommitDialogOpen(false); setCommitError(null); } }}
                onCommit={(msg) => void handleCommit(msg)}
            />
            <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} folders={folders} documents={rootDocuments} onSelectDocument={(d) => void handleSelectDocument(d)} onNewDocument={() => { setNewDocInitialFolder(null); setNewDocOpen(true); }} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
            <NewDocumentModal open={newDocOpen} onOpenChange={setNewDocOpen} folders={folders} documents={rootDocuments} onCreate={handleCreateDocument} repoConnected={!!selectedRepository} initialFolder={newDocInitialFolder} />
            <NewFolderModal open={newFolderOpen} onOpenChange={setNewFolderOpen} folders={folders} onCreate={handleCreateFolder} initialParent={newFolderInitialParent} />
            <RenameDocumentModal open={!!renameDoc} onOpenChange={(v) => !v && setRenameDoc(null)} currentName={renameDoc?.name ?? ""} onRename={handleRenameDocument} />
            <RenameFolderModal open={!!renameFolderTarget} onOpenChange={(v) => !v && setRenameFolderTarget(null)} currentName={renameFolderTarget?.name ?? ""} onRename={handleRenameFolder} />
            <MoveDocumentModal open={!!moveDoc} onOpenChange={(v) => !v && setMoveDoc(null)} folders={folders} document={moveDoc} onMove={handleMoveDocument} />
            <ConfirmDialog open={!!deleteDoc} onOpenChange={(v) => !v && setDeleteDoc(null)} title="Delete document?" description="This action will remove the document from your GitNote workspace." confirmLabel="Delete" onConfirm={handleDeleteDocument} />
            <ConfirmDialog open={!!deleteFolderTarget} onOpenChange={(v) => !v && setDeleteFolderTarget(null)} title="Delete folder?" description={deleteFolderTarget ? `This will remove “${deleteFolderTarget.name}” and all its documents from your workspace.` : "This will remove the folder."} confirmLabel="Delete" onConfirm={handleDeleteFolder} />
            <ConfirmDialog
                open={restoreConfirm?.type === "commit"}
                onOpenChange={(v) => !v && setRestoreConfirm(null)}
                title="Restore this commit?"
                description={changes.length > 0 ? "You have uncommitted changes. This will replace your current workspace with the version from this commit. Your current changes will not be committed. Continue?" : "This will replace your current workspace with the version from this commit. Your current changes will not be committed."}
                confirmLabel="Restore"
                onConfirm={() => void handleRestoreCommit()}
            />
            <ConfirmDialog
                open={restoreConfirm?.type === "file"}
                onOpenChange={(v) => !v && setRestoreConfirm(null)}
                title="Restore this file?"
                description={changes.length > 0 ? "You have uncommitted changes. This will replace the current version in your workspace. Your current changes will remain uncommitted. Continue?" : "This will replace the current version in your workspace."}
                confirmLabel="Restore"
                onConfirm={() => restoreConfirm?.file && void handleRestoreFile(restoreConfirm.file)}
            />
            <WorkspaceSettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                account={account}
                repositories={repositories}
                selectedRepository={selectedRepository}
                installUrl={githubInstallUrl}
                loading={repositoriesLoading}
                error={githubError}
                onRetry={() => window.location.reload()}
                onSelectRepository={(repository) => { setSettingsOpen(false); void handleSelectRepository(repository); }}
            />
            <Toaster richColors position="top-right" />
        </div>
    );
}

function WorkspaceDashboard({
    repository,
    folders,
    rootDocuments,
    changes,
    onSelectDocument,
    onNewDocument,
    onNewFolder,
    onOpenSettings,
    onOpenHistory,
}: {
    repository: GitHubRepository;
    folders: Folder[];
    rootDocuments: Note[];
    changes: WorkspaceChange[];
    onSelectDocument: (doc: Note) => void;
    onNewDocument: () => void;
    onNewFolder: () => void;
    onOpenSettings: () => void;
    onOpenHistory: () => void;
}) {
    const { totalDocs, totalFolders, recentDocs, hasDocs } = useMemo(() => {
        const docs = flattenNotes(folders, rootDocuments);
        const countFolders = (fs: Folder[]): number => fs.reduce((acc, f) => acc + 1 + countFolders(f.folders ?? []), 0);
        return {
            totalDocs: docs.length,
            totalFolders: countFolders(folders),
            recentDocs: [...docs].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8),
            hasDocs: docs.length > 0,
        };
    }, [folders, rootDocuments]);

    return (
        <div className="scroll-thin flex flex-1 justify-center overflow-y-auto bg-background">
            <div className="w-full max-w-3xl px-8 py-10">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="label-caps text-muted-foreground">Workspace</p>
                        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight truncate">{repository.fullName}</h1>
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${repository.private ? "border-chrome-border bg-chrome" : "border-success/20 bg-success/10 text-success"}`}>{repository.private ? "Private" : "Public"}</span>
                            <span>{repository.defaultBranch}</span>
                            {repository.description && <span className="hidden sm:inline">· {repository.description}</span>}
                        </p>
                    </div>
                    <button type="button" onClick={onOpenSettings} className="shrink-0 rounded-md border border-chrome-border bg-chrome px-3 py-1.5 text-xs font-medium hover:bg-chrome-hover">Cambiar workspace</button>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-panel"><p className="font-display text-xl font-semibold">{totalFolders}</p><p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Folders</p></div>
                    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-panel"><p className="font-display text-xl font-semibold">{totalDocs}</p><p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Documents</p></div>
                    <div className={`rounded-xl border px-4 py-3.5 shadow-panel ${changes.length > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}><p className="font-display text-xl font-semibold">{changes.length}</p><p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{changes.length === 1 ? "Change" : "Changes"}</p></div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                    <button type="button" onClick={onNewDocument} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">New document</button>
                    <button type="button" onClick={onNewFolder} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">New folder</button>
                    <button type="button" onClick={onOpenHistory} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">History</button>
                </div>

                {!hasDocs ? (
                    <div className="mt-10 rounded-xl border border-dashed border-chrome-border bg-card p-8 text-center">
                        <p className="text-sm font-medium">No hay documentos aún</p>
                        <p className="mt-1 text-sm text-muted-foreground">Crea tu primer documento o carpeta para empezar a trabajar en este workspace.</p>
                        <div className="mt-4 flex justify-center gap-2">
                            <button type="button" onClick={onNewDocument} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">Crear documento</button>
                            <button type="button" onClick={onNewFolder} className="rounded-md border border-input px-4 py-1.5 text-sm">Crear carpeta</button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-10">
                        <h2 className="label-caps text-muted-foreground">Documents</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Selecciona un documento de la lista o desde la barra lateral.</p>
                        <div className="mt-3 grid gap-2">
                            {recentDocs.map((doc) => (
                                <button key={doc.id} type="button" onClick={() => onSelectDocument(doc)} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-panel transition hover:bg-accent">
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{doc.name}</span>
                                        <span className="block truncate font-mono text-xs text-muted-foreground">{doc.path}</span>
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">Abrir →</span>
                                </button>
                            ))}
                        </div>
                        {totalDocs > recentDocs.length && <p className="mt-3 text-xs text-muted-foreground text-center">y {totalDocs - recentDocs.length} más en la barra lateral…</p>}
                    </div>
                )}
            </div>
        </div>
    );
}

function WorkspaceSettingsDialog({
    open,
    onOpenChange,
    account,
    repositories,
    selectedRepository,
    installUrl,
    loading,
    error,
    onRetry,
    onSelectRepository,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    account: GitHubAccount | null;
    repositories: GitHubRepository[];
    selectedRepository: GitHubRepository | null;
    installUrl: string | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    onSelectRepository: (r: GitHubRepository) => void;
}) {
    const [newRepoName, setNewRepoName] = useState("gitnote-notes");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createdRepos, setCreatedRepos] = useState<GitHubRepository[]>([]);

    async function handleCreateRepository() {
        const name = newRepoName.trim();
        if (!name) return;
        setCreating(true);
        setCreateError(null);
        try {
            const response = await fetch("/api/github/repositories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, private: true }),
            });
            const data = (await response.json()) as { repository?: GitHubRepository; error?: string; details?: string };
            if (!response.ok || !data.repository) {
                const detail = data.details ? ` — ${data.details.slice(0, 300)}` : "";
                throw new Error((data.error ?? "Unable to create repository.") + detail);
            }
            setCreatedRepos((prev) => [data.repository!, ...prev]);
            onSelectRepository(data.repository!);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Unable to create repository.");
        } finally {
            setCreating(false);
        }
    }

    const displayRepos = (() => {
        const map = new Map<number, GitHubRepository>();
        for (const r of [...createdRepos, ...repositories]) map.set(r.id, r);
        return [...map.values()];
    })();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Workspace settings</DialogTitle>
                    <DialogDescription>Cambia de workspace o crea uno nuevo. Cada repositorio de GitHub es un workspace.</DialogDescription>
                </DialogHeader>

                {account && (
                    <p className="text-xs text-muted-foreground">Conectado como <span className="font-medium text-foreground">@{account.login}</span>{selectedRepository && <span> · actual: <span className="font-mono">{selectedRepository.fullName}</span></span>}</p>
                )}

                <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-medium">Crear nuevo workspace</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Se creará un repositorio privado con README inicial.</p>
                    <div className="mt-3 flex gap-2">
                        <input value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="mi-workspace" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                        <button type="button" onClick={() => void handleCreateRepository()} disabled={creating || !newRepoName.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {creating ? "Creando…" : "Crear"}
                        </button>
                    </div>
                    {createError && <p className="mt-2 text-sm text-destructive">{createError}</p>}
                </div>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <h3 className="label-caps text-muted-foreground mt-2">Repositories</h3>
                    {loading && <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={14} /> Loading repositories…</div>}
                    {error && (
                        <div className="mt-3">
                            <p className="text-sm text-destructive">{error}</p>
                            <button type="button" onClick={onRetry} className="mt-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">Try again.</button>
                        </div>
                    )}
                    {!loading && !error && displayRepos.length === 0 && (
                        <div className="mt-3">
                            <p className="text-sm text-muted-foreground">No repositories found. Crea tu primer workspace arriba.</p>
                            {installUrl && <a href={installUrl} className="mt-3 inline-flex rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">Instalar GitHub App</a>}
                        </div>
                    )}
                    <div className="mt-3 grid gap-2 overflow-y-auto scroll-thin pr-1 flex-1">
                        {displayRepos.map((repository) => {
                            const selected = selectedRepository?.id === repository.id;
                            return (
                                <button key={repository.id} type="button" onClick={() => onSelectRepository(repository)} className={`rounded-lg border p-3 text-left transition hover:bg-accent ${selected ? "border-primary bg-accent" : "border-border bg-card"}`}>
                                    <span className="block text-sm font-medium">{repository.name}</span>
                                    <span className="mt-1 block font-mono text-xs text-muted-foreground">{repository.private ? "Private" : "Public"} · {repository.defaultBranch} · {repository.fullName}</span>
                                    {selected && <span className="mt-1.5 inline-block rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">Actual</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function GitHubRepositorySelection({
    account,
    repositories,
    selectedRepository,
    installUrl,
    loading,
    error,
    onRetry,
    onSelectRepository,
}: {
    account: GitHubAccount;
    repositories: GitHubRepository[];
    selectedRepository: GitHubRepository | null;
    installUrl: string | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    onSelectRepository: (repository: GitHubRepository) => void;
}) {
    const [newRepoName, setNewRepoName] = useState("gitnote-notes");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createdRepos, setCreatedRepos] = useState<GitHubRepository[]>([]);

    async function handleCreateRepository() {
        const name = newRepoName.trim();
        if (!name) return;
        setCreating(true);
        setCreateError(null);
        try {
            const response = await fetch("/api/github/repositories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, private: true }),
            });
            const data = (await response.json()) as { repository?: GitHubRepository; error?: string; details?: string };
            if (!response.ok || !data.repository) {
                const detail = data.details ? ` — ${data.details.slice(0,300)}` : "";
                throw new Error((data.error ?? "Unable to create repository.") + detail);
            }
            setCreatedRepos((prev) => [data.repository!, ...prev]);
            onSelectRepository(data.repository!);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Unable to create repository.");
        } finally {
            setCreating(false);
        }
    }

    const displayRepos = (() => {
        const map = new Map<number, GitHubRepository>();
        for (const r of [...createdRepos, ...repositories]) map.set(r.id, r);
        return [...map.values()];
    })();

    return (
        <div className="w-full max-w-3xl px-8 py-10">
            <div>
                <p className="label-caps text-muted-foreground">GitHub</p>
                <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Connected as @{account.login}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Elige un repo para usar como workspace o crea uno nuevo — como en Notion, cada repo es un workspace.</p>
            </div>

            <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-panel">
                <h3 className="text-sm font-medium">Crear nuevo workspace</h3>
                <p className="mt-1 text-xs text-muted-foreground">Se creará un repositorio privado con README inicial.</p>
                <div className="mt-3 flex gap-2">
                    <input value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="mi-workspace" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    <button type="button" onClick={() => void handleCreateRepository()} disabled={creating || !newRepoName.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                        {creating ? "Creando…" : "Crear"}
                    </button>
                </div>
                {createError && <p className="mt-2 text-sm text-destructive">{createError}</p>}
            </div>

            <div className="mt-8">
                <h2 className="label-caps text-muted-foreground">Repositories</h2>
                {loading && <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={14} /> Loading repositories…</div>}
                {error && (
                    <div className="mt-4">
                        <p className="text-sm text-destructive">{error}</p>
                        <button type="button" onClick={onRetry} className="mt-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">Try again.</button>
                    </div>
                )}
                {!loading && !error && displayRepos.length === 0 && (
                    <div className="mt-4">
                        <p className="text-sm text-muted-foreground">No repositories found. Crea tu primer workspace arriba.</p>
                        {installUrl && <a href={installUrl} className="mt-3 inline-flex rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">O instalar GitHub App</a>}
                    </div>
                )}
                <div className="mt-4 grid gap-3">
                    {displayRepos.map((repository) => {
                        const selected = selectedRepository?.id === repository.id;
                        return (
                            <button key={repository.id} type="button" onClick={() => onSelectRepository(repository)} className={`rounded-xl border p-4 text-left shadow-panel transition hover:bg-accent ${selected ? "border-primary bg-accent" : "border-border bg-card"}`}>
                                <span className="block text-sm font-medium">{repository.name}</span>
                                <span className="mt-1 block font-mono text-xs text-muted-foreground">{repository.private ? "Private" : "Public"} · {repository.defaultBranch} · {repository.fullName}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function updateDocumentInFolders(folders: Folder[], updatedDocument: Note): Folder[] {
    return folders.map((folder) => ({
        ...folder,
        documents: folder.documents.map((note) =>
            note.id === updatedDocument.id ? updatedDocument : note,
        ),
        folders: folder.folders
            ? updateDocumentInFolders(folder.folders, updatedDocument)
            : undefined,
    }));
}

function insertIntoFolderTree(folders: Folder[], folderPath: string, note: Note): Folder[] | null {
    // Returns new tree if inserted, null if folderPath not found
    let inserted = false;
    const next = folders.map((f) => {
        // For simplicity, match by folder name or by id suffix; we treat top-level name as path segment
        // Recurse if folderPath starts with this folder's name
        if (folderPath === f.name || folderPath.startsWith(f.name + "/")) {
            const remainder = folderPath === f.name ? "" : folderPath.slice(f.name.length + 1);
            if (!remainder) {
                inserted = true;
                return { ...f, documents: [...f.documents, note].sort((a, b) => a.name.localeCompare(b.name)) };
            }
            if (f.folders) {
                const sub = insertIntoFolderTree(f.folders, remainder, note);
                if (sub) {
                    inserted = true;
                    return { ...f, folders: sub };
                }
            }
        }
        return f;
    });
    return inserted ? next : null;
}

function buildRepositoryDocuments(
    repository: GitHubRepository,
    tree: GitHubRepositoryTree,
): RepositoryDocuments {
    const folderMap = new Map<string, Folder>();
    const rootDocuments: Note[] = [];

    for (const folderPath of tree.folders) {
        folderMap.set(folderPath, {
            id: `github-folder:${repository.fullName}:${folderPath}`,
            name: getBaseName(folderPath),
            documents: [],
            folders: [],
        });
    }

    const topLevelFolders: Folder[] = [];

    for (const [folderPath, folder] of folderMap) {
        const parentPath = getParentPath(folderPath);

        if (!parentPath) {
            topLevelFolders.push(folder);
            continue;
        }

        const parentFolder = folderMap.get(parentPath);

        if (parentFolder) {
            parentFolder.folders = [...(parentFolder.folders ?? []), folder];
        }
    }

    for (const file of tree.files) {
        const document: Note = {
            id: `github-file:${repository.fullName}:${file.path}`,
            name: file.name,
            path: file.path,
            content: "",
            source: {
                type: "github",
                owner: repository.owner,
                repo: repository.name,
                branch: repository.defaultBranch,
                path: file.path,
                sha: file.sha,
            },
        };
        const parentPath = getParentPath(file.path);

        if (!parentPath) {
            rootDocuments.push(document);
            continue;
        }

        const parentFolder = folderMap.get(parentPath);

        if (parentFolder) {
            parentFolder.documents.push(document);
        }
    }

    return {
        folders: sortFolders(topLevelFolders),
        documents: rootDocuments.sort(compareDocuments),
    };
}

function sortFolders(folders: Folder[]): Folder[] {
    return folders
        .map((folder) => ({
            ...folder,
            documents: [...folder.documents].sort(compareDocuments),
            folders: sortFolders(folder.folders ?? []),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

function compareDocuments(left: Note, right: Note): number {
    return left.name.localeCompare(right.name);
}

function getParentPath(path: string): string | null {
    const segments = path.split("/");

    if (segments.length <= 1) {
        return null;
    }

    return segments.slice(0, -1).join("/");
}

function getBaseName(path: string): string {
    return path.split("/").at(-1) ?? path;
}

function getInitialFolders(): Folder[] {
    if (typeof window === "undefined") {
        return initialFolders;
    }

    const savedFolders = window.localStorage.getItem("gitnote-folders");

    if (!savedFolders) {
        return initialFolders;
    }

    try {
        const parsedFolders = JSON.parse(savedFolders) as unknown;

        if (Array.isArray(parsedFolders)) {
            return parsedFolders as Folder[];
        }
    } catch {
        return initialFolders;
    }

    return initialFolders;
}

function isSessionResponse(value: unknown): value is SessionResponse {
    if (!value || typeof value !== "object" || !("connected" in value)) {
        return false;
    }

    const response = value as {
        connected: unknown;
        account?: unknown;
        installUrl?: unknown;
    };

    if (response.connected === false) {
        return (
            typeof response.installUrl === "string" ||
            response.installUrl === null ||
            typeof response.installUrl === "undefined"
        );
    }

    return (
        response.connected === true &&
        isGitHubAccount(response.account) &&
        (typeof response.installUrl === "string" || response.installUrl === null)
    );
}

function isRepositoriesResponse(value: unknown): value is RepositoriesResponse {
    if (!value || typeof value !== "object" || !("repositories" in value)) {
        return false;
    }

    const response = value as { repositories: unknown };

    return Array.isArray(response.repositories) && response.repositories.every(isRepository);
}

function isTreeResponse(value: unknown): value is TreeResponse {
    if (!value || typeof value !== "object" || !("tree" in value)) {
        return false;
    }

    const response = value as { tree: unknown };
    const tree = response.tree as GitHubRepositoryTree | undefined;

    return (
        !!tree &&
        Array.isArray(tree.folders) &&
        tree.folders.every((folder) => typeof folder === "string") &&
        Array.isArray(tree.files) &&
        tree.files.every(isMarkdownFile)
    );
}

function isFileResponse(value: unknown): value is FileResponse {
    if (!value || typeof value !== "object" || !("file" in value)) {
        return false;
    }

    const response = value as { file: unknown };
    const file = response.file as FileResponse["file"] | undefined;

    return (
        !!file &&
        typeof file.name === "string" &&
        typeof file.path === "string" &&
        typeof file.content === "string" &&
        typeof file.sha === "string"
    );
}

function isGitHubAccount(value: unknown): value is GitHubAccount {
    const account = value as GitHubAccount | undefined;

    return (
        !!account &&
        typeof account.id === "number" &&
        typeof account.login === "string" &&
        (typeof account.name === "string" || account.name === null) &&
        typeof account.avatarUrl === "string"
    );
}

function isRepository(value: unknown): value is GitHubRepository {
    const repository = value as GitHubRepository | undefined;

    return (
        !!repository &&
        typeof repository.id === "number" &&
        typeof repository.name === "string" &&
        typeof repository.fullName === "string" &&
        typeof repository.owner === "string" &&
        typeof repository.private === "boolean" &&
        typeof repository.defaultBranch === "string" &&
        (typeof repository.description === "string" || repository.description === null)
    );
}

function isMarkdownFile(value: unknown): value is GitHubMarkdownFile {
    const file = value as GitHubMarkdownFile | undefined;

    return (
        !!file &&
        typeof file.name === "string" &&
        typeof file.path === "string" &&
        typeof file.sha === "string" &&
        (typeof file.size === "number" || typeof file.size === "undefined")
    );
}
