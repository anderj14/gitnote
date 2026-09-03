"use client"

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { Editor } from "./editor";
import { CommitDialog } from "./commit-dialog";
import { TopBar } from "./top-bar";
import { SearchCommand } from "./search-command";
import { NewDocumentModal } from "./new-document-modal";
import { RightPanel } from "./right-panel";
import { Toaster } from "sonner";
import { cn } from "@/app/lib/utils";
import type { Folder, Note, SaveStatus } from "./types";

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

        localStorage.setItem(
            "gitnote-folders",
            JSON.stringify(folders),
        );
    }, [account, folders]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            if (e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
            else if (e.key.toLowerCase() === "n") { e.preventDefault(); setNewDocOpen(true); }
            else if (e.key.toLowerCase() === "b") { e.preventDefault(); setSidebarOpen((v) => !v); }
            else if (e.key === ".") { e.preventDefault(); setPanelOpen((v) => !v); }
            else if (e.key.toLowerCase() === "l" && e.shiftKey) { e.preventDefault(); setEditorTheme((t) => (t === "light" ? "dark" : "light")); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);


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
            return;
        }

        // GitHub docs: track unsaved vs saved
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

        const updatedDocument = {
            ...selectedDocument,
            name,
        };

        setSelectedDocument(updatedDocument);

        if (!selectedDocument.source) {
            setFolders((currentFolders) => updateDocumentInFolders(currentFolders, updatedDocument));
        }
        // For GitHub docs, name is filename — renaming not committed via updateFile.
        // We intentionally don't flip saveStatus for name alone (commit is for markdown content).
    }

    function handleCreateDocument(note: Note) {
        // If repo connected, we'd need to commit new file via GitHub API; for now treat as local until saved
        // Insert into appropriate folder or root
        const path = note.path;
        const folderPath = path.includes("/") ? path.split("/").slice(0, -1).join("/") : null;

        if (!folderPath) {
            setRootDocuments((prev) => [...prev, note].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
            // Try to insert into existing folder tree, else create top-level folder
            setFolders((prev) => {
                const found = insertIntoFolderTree(prev, folderPath, note);
                if (found) return found;
                // Create new folder at top level
                const newFolder: Folder = { id: `local-folder:${folderPath}`, name: folderPath.split("/").pop() ?? folderPath, documents: [note], folders: [] };
                return [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name));
            });
        }
        setSelectedDocument(note);
        setLastSavedContent(note.content);
        setSaveStatus("saved");
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

    async function handleCommit(commitMessageParam: string) {
        if (!selectedDocument?.source) return;
        const trimmed = commitMessageParam.trim();
        if (!trimmed) {
            setCommitError("Commit message is required.");
            return;
        }
        if (saveStatus === "saving") return;
        // Avoid commit if no changes
        if (selectedDocument.content === lastSavedContent) {
            setCommitDialogOpen(false);
            setSaveStatus("saved");
            return;
        }

        setSaveStatus("saving");
        setCommitError(null);

        try {
            const response = await fetch("/api/github/file", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner: selectedDocument.source.owner,
                    repo: selectedDocument.source.repo,
                    path: selectedDocument.source.path,
                    branch: selectedDocument.source.branch,
                    sha: selectedDocument.source.sha,
                    content: selectedDocument.content,
                    message: trimmed,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as { error?: string; file?: { sha: string; path: string } };

            if (!response.ok || !data.file) {
                const friendly =
                    data.error ??
                    (response.status === 409
                        ? "This file changed on GitHub. Reload the file before saving again."
                        : response.status === 401 || response.status === 403
                            ? "You don't have permission to modify this file."
                            : response.status >= 500
                                ? "Unable to connect to GitHub."
                                : "Unable to save changes. Please try again.");
                throw new Error(friendly);
            }

            // Success: update sha and mark saved
            const newSha = data.file.sha;
            setLastSavedContent(selectedDocument.content);
            setSelectedDocument((prev) =>
                prev && prev.source
                    ? { ...prev, source: { ...prev.source, sha: newSha } }
                    : prev,
            );
            setSaveStatus("saved");
            setCommitDialogOpen(false);
            setGithubError(null);
            // Tree remains consistent — file path unchanged
        } catch (err) {
            console.error("Save failed:", err);
            const message =
                err instanceof Error ? err.message : "Unable to save changes. Please try again.";
            // Map network errors
            if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
                setCommitError("Unable to connect to GitHub.");
            } else {
                setCommitError(message);
            }
            setSaveStatus("error");
        }
    }

    async function handleSelectRepository(repository: GitHubRepository) {
        setSelectedRepository(repository);
        setSelectedDocument(null);
        setFolders([]);
        setRootDocuments([]);
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
        } catch {
            setGithubError("Unable to load repository files.");
        } finally {
            setTreeLoading(false);
        }
    }

    async function handleSelectDocument(document: Note) {
        if (!document.source) {
            setSelectedDocument(document);
            setLastSavedContent(document.content);
            setSaveStatus("saved");
            setCommitDialogOpen(false);
            setCommitError(null);
            return;
        }

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
            const response = await fetch(`/api/github/file?${params.toString()}`);
            const data = (await response.json()) as unknown;

            if (!response.ok || !isFileResponse(data)) {
                throw new Error("Unable to load document.");
            }

            const file = data.file;
            setLastSavedContent(file.content);
            setSaveStatus("saved");
            setCommitDialogOpen(false);
            setCommitError(null);
            setSelectedDocument({
                ...document,
                name: file.name,
                content: file.content,
                source: {
                    ...document.source,
                    sha: file.sha,
                },
            });
        } catch {
            setGithubError("Unable to load document.");
        } finally {
            setDocumentLoading(false);
        }
    }

    async function handleLogout() {
        await fetch("/api/github/logout", { method: "POST" });
        // Keep preference for next login (cross-device) - only clear local if you want truly fresh
        // To clear cross-device too, uncomment: await fetch("/api/github/selected-repo", { method: "DELETE" }).catch(()=>{});
        try { localStorage.removeItem("gitnote:selectedRepo"); } catch {}
        setAccount(null);
        setRepositories([]);
        setSelectedRepository(null);
        setSelectedDocument(null);
        setRootDocuments([]);
        setFolders(initialFolders);
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
        saveStatus !== "saved" &&
        saveStatus !== "saving" &&
        !!selectedDocument &&
        selectedDocument.content !== lastSavedContent;

    const breadcrumbs = selectedDocument
        ? [selectedRepository?.name ?? workspaceLabel, selectedDocument.name]
        : selectedRepository
            ? [workspaceLabel, selectedRepository.name]
            : [workspaceLabel];

    const gitStatus: "Synced" | "Modified" | "Untracked" =
        saveStatus === "unsaved" || saveStatus === "error" ? "Modified" : saveStatus === "saving" ? "Modified" : "Synced";

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            <aside className={cn("shrink-0 overflow-hidden border-r border-chrome-border transition-[width] duration-200", sidebarOpen ? "w-[264px]" : "w-0 border-r-0")}>
                <div className="h-full w-[264px]">
                    <Sidebar
                        folders={folders}
                        documents={rootDocuments}
                        selectedDocumentId={selectedDocument?.id ?? null}
                        workspaceLabel={workspaceLabel}
                        status={sidebarStatus}
                        repoName={selectedRepository?.name ?? null}
                        repoBranch={selectedRepository?.defaultBranch ?? null}
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
                        onNewDocument={() => setNewDocOpen(true)}
                    />
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar breadcrumbs={breadcrumbs} status={gitStatus} onToggleSidebar={() => setSidebarOpen((v) => !v)} onTogglePanel={() => setPanelOpen((v) => !v)} onSearch={() => setSearchOpen(true)} accountLogin={account?.login ?? null} />

                <div className={cn("flex min-h-0 flex-1", selectedDocument ? "bg-editor" : "bg-background")}>
                    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <div className={cn("flex flex-1 flex-col", selectedDocument ? "overflow-hidden" : "overflow-y-auto")}>
                    {documentLoading ? (
                        <div className="flex flex-1 items-center justify-center"><p className="text-sm text-chrome-muted">Loading document…</p></div>
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
                            <CommitDialog
                                open={commitDialogOpen}
                                fileName={selectedDocument.name}
                                message={commitMessage}
                                onMessageChange={setCommitMessage}
                                saving={saveStatus === "saving"}
                                error={commitError}
                                onClose={() => { if (saveStatus !== "saving") { setCommitDialogOpen(false); setCommitError(null); } }}
                                onCommit={(msg) => void handleCommit(msg)}
                            />
                            {saveStatus === "error" && !commitDialogOpen && commitError && (
                                <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-float">
                                    {commitError}
                                </div>
                            )}
                        </div>
                    ) : account ? (
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
            <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} folders={folders} documents={rootDocuments} onSelectDocument={(d) => void handleSelectDocument(d)} onNewDocument={() => setNewDocOpen(true)} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
            <NewDocumentModal open={newDocOpen} onOpenChange={setNewDocOpen} folders={folders} documents={rootDocuments} onCreate={handleCreateDocument} repoConnected={!!selectedRepository} />
            <Toaster richColors position="top-right" />
        </div>
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
                {loading && <p className="mt-4 text-sm text-muted-foreground">Loading repositories…</p>}
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
        const currentPath = f.name;
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
