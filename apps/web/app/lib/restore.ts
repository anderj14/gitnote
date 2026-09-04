import type { Folder, Note } from "@/app/components/types";
import { flattenNotes } from "./workspace";
import type { OriginalSnapshot } from "./workspace-changes";

/**
 * Restore a single file from historical content to current workspace.
 * Does NOT modify originalSnapshot. Returns new folders/rootDocs.
 * Handles added/modified/removed/renamed by upserting/deleting at path.
 */
export function restoreFileInWorkspace(
  folders: Folder[],
  rootDocs: Note[],
  targetPath: string,
  previousPath: string | undefined,
  content: string | null, // null means deleted (remove)
  status: "added" | "modified" | "removed" | "renamed",
  fullName: string
): { folders: Folder[]; rootDocs: Note[] } {
  // For renamed, remove previousPath if different
  let currentFolders = folders;
  let currentRoot = rootDocs;

  if (status === "renamed" && previousPath && previousPath !== targetPath) {
    const all = flattenNotes(currentFolders, currentRoot);
    const prev = all.find((d) => d.path === previousPath);
    if (prev) {
      const res = removeDoc(currentFolders, currentRoot, prev.id);
      currentFolders = res.folders;
      currentRoot = res.rootDocs;
    }
  }

  if (status === "removed" || content === null) {
    const all = flattenNotes(currentFolders, currentRoot);
    const existing = all.find((d) => d.path === targetPath);
    if (existing) {
      const res = removeDoc(currentFolders, currentRoot, existing.id);
      return res;
    }
    return { folders: currentFolders, rootDocs: currentRoot };
  }

  // upsert at targetPath
  const all = flattenNotes(currentFolders, currentRoot);
  const existing = all.find((d) => d.path === targetPath);
  if (existing) {
    const updated: Note = { ...existing, content: content!, name: targetPath.split("/").pop() ?? targetPath };
    return {
      folders: updateDocInFolders(currentFolders, updated),
      rootDocs: currentRoot.map((d) => (d.id === existing.id ? updated : d)),
    };
  }

  // create new
  const note: Note = {
    id: `github-file:${fullName}:${targetPath}`,
    name: targetPath.split("/").pop() ?? targetPath,
    path: targetPath,
    content: content!,
  };
  const folderPath = targetPath.includes("/") ? targetPath.split("/").slice(0, -1).join("/") : null;
  if (!folderPath) {
    return { folders: currentFolders, rootDocs: [...currentRoot, note].sort((a, b) => a.name.localeCompare(b.name)) };
  }
  const inserted = insertIntoFolderTreeLocal(currentFolders, folderPath, note);
  if (inserted) return { folders: inserted, rootDocs: currentRoot };
  const newFolder: Folder = { id: `github-folder:${fullName}:${folderPath}`, name: folderPath.split("/").pop() ?? folderPath, documents: [note], folders: [] };
  return { folders: [...currentFolders, newFolder].sort((a, b) => a.name.localeCompare(b.name)), rootDocs: currentRoot };
}

/**
 * Restore full commit state to workspace.
 * commitFiles: all markdown files at commit with content
 * Does NOT modify originalSnapshot.
 */
export function restoreCommitInWorkspace(
  _folders: Folder[],
  _rootDocs: Note[],
  commitFiles: Array<{ path: string; content: string }>,
  commitFolders: string[],
  fullName: string
): { folders: Folder[]; rootDocs: Note[] } {
  const folderMap = new Map<string, Folder>();
  for (const folderPath of commitFolders) {
    folderMap.set(folderPath, { id: `github-folder:${fullName}:${folderPath}`, name: folderPath.split("/").pop() ?? folderPath, documents: [], folders: [] });
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
  const docs: Note[] = commitFiles.map((c) => ({
    id: `github-file:${fullName}:${c.path}`,
    name: c.path.split("/").pop() ?? c.path,
    path: c.path,
    content: c.content,
  }));
  const rootDocs: Note[] = [];
  for (const doc of docs) {
    const parentPath = doc.path.includes("/") ? doc.path.split("/").slice(0, -1).join("/") : null;
    if (!parentPath) rootDocs.push(doc);
    else {
      const parent = folderMap.get(parentPath);
      if (parent) parent.documents.push(doc);
      else rootDocs.push(doc);
    }
  }
  const sortFolders = (fs: Folder[]): Folder[] =>
    fs
      .map((f) => ({ ...f, documents: [...f.documents].sort((a, b) => a.name.localeCompare(b.name)), folders: f.folders ? sortFolders(f.folders) : [] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  return { folders: sortFolders(topLevel), rootDocs: rootDocs.sort((a, b) => a.name.localeCompare(b.name)) };
}

export function assertSnapshotUnchanged(original: OriginalSnapshot, afterRestoreSnapshot: OriginalSnapshot): boolean {
  // shallow compare length and paths/contents
  if (original.length !== afterRestoreSnapshot.length) return false;
  const a = [...original].sort((x, y) => x.path.localeCompare(y.path));
  const b = [...afterRestoreSnapshot].sort((x, y) => x.path.localeCompare(y.path));
  for (let i = 0; i < a.length; i++) {
    if (a[i].path !== b[i].path || a[i].content !== b[i].content) return false;
  }
  return true;
}

// local helpers to avoid circular deps
function removeDoc(folders: Folder[], rootDocs: Note[], id: string): { folders: Folder[]; rootDocs: Note[] } {
  const newRoot = rootDocs.filter((d) => d.id !== id);
  if (newRoot.length !== rootDocs.length) return { folders, rootDocs: newRoot };
  function walk(fs: Folder[]): Folder[] {
    return fs.map((f) => {
      const filtered = f.documents.filter((d) => d.id !== id);
      const sub = f.folders ? walk(f.folders) : undefined;
      if (filtered.length !== f.documents.length || sub !== f.folders) return { ...f, documents: filtered, folders: sub };
      return f;
    });
  }
  return { folders: walk(folders), rootDocs };
}

function updateDocInFolders(folders: Folder[], updated: Note): Folder[] {
  return folders.map((f) => ({
    ...f,
    documents: f.documents.map((d) => (d.id === updated.id ? updated : d)),
    folders: f.folders ? updateDocInFolders(f.folders, updated) : undefined,
  }));
}

function insertIntoFolderTreeLocal(folders: Folder[], folderPath: string, note: Note): Folder[] | null {
  let inserted = false;
  const next = folders.map((f) => {
    if (folderPath === f.name || folderPath.startsWith(f.name + "/")) {
      const rem = folderPath === f.name ? "" : folderPath.slice(f.name.length + 1);
      if (!rem) {
        inserted = true;
        return { ...f, documents: [...f.documents, note].sort((a, b) => a.name.localeCompare(b.name)) };
      }
      if (f.folders) {
        const sub = insertIntoFolderTreeLocal(f.folders, rem, note);
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
