import type { Folder, Note } from "@/app/components/types";

// ---------- Path helpers ----------

export function joinPath(folderPath: string, fileName: string): string {
  if (!folderPath || folderPath === "Root") return fileName;
  return `${folderPath}/${fileName}`;
}

export function getParentPath(path: string): string | null {
  const segments = path.split("/");
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join("/");
}

export function getBaseName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function getFolderPathForDocument(doc: Note): string | null {
  return getParentPath(doc.path);
}

export function updateDocumentPath(doc: Note, newPath: string): Note {
  const newName = getBaseName(newPath);
  const updated: Note = { ...doc, path: newPath, name: newName };
  // Keep GitHub source.path in sync locally (no commit), but preserve sha/owner/etc
  if (doc.source) {
    updated.source = { ...doc.source, path: newPath };
  }
  return updated;
}

// ---------- Validation ----------

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*\x00-\x1F]/;
const INVALID_FILE_CHARS = /[<>:"/\\|?*\x00-\x1F]/;

export function validateFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Folder name is required.";
  if (trimmed.length > 100) return "Folder name is too long.";
  if (INVALID_FOLDER_CHARS.test(trimmed)) return "Folder name contains invalid characters.";
  if (trimmed === "." || trimmed === "..") return "Invalid folder name.";
  if (trimmed.endsWith(".")) return "Folder name cannot end with a dot.";
  return null;
}

export function validateDocumentName(name: string): string | null {
  let trimmed = name.trim();
  if (!trimmed) return "Document name is required.";
  // Auto-append .md if missing for validation
  if (!trimmed.toLowerCase().endsWith(".md")) trimmed += ".md";
  const base = trimmed.slice(0, -3);
  if (!base) return "Document name is required.";
  if (base.length > 100) return "Document name is too long.";
  if (INVALID_FILE_CHARS.test(base)) return "Document name contains invalid characters.";
  if (base === "." || base === "..") return "Invalid document name.";
  return null;
}

export function normalizeDocumentName(input: string): string {
  let t = input.trim();
  if (!t) return "Untitled.md";
  // Remove invalid chars minimally
  // Keep user input mostly intact, just ensure .md suffix
  if (!t.toLowerCase().endsWith(".md")) t += ".md";
  return t;
}

export function ensureMarkdownSuffix(name: string): string {
  const t = name.trim();
  if (!t.toLowerCase().endsWith(".md")) return `${t}.md`;
  return t;
}

// ---------- Folder tree helpers ----------

export function findFolderByPath(folders: Folder[], folderPath: string): Folder | null {
  if (!folderPath || folderPath === "Root") return null;
  const segments = folderPath.split("/");
  let currentFolders = folders;
  let found: Folder | null = null;
  for (const seg of segments) {
    found = currentFolders.find((f) => f.name === seg) ?? null;
    if (!found) return null;
    currentFolders = found.folders ?? [];
  }
  return found;
}

export function findFolderById(folders: Folder[], id: string): Folder | null {
  for (const f of folders) {
    if (f.id === id) return f;
    if (f.folders) {
      const sub = findFolderById(f.folders, id);
      if (sub) return sub;
    }
  }
  return null;
}

export function getFolderPathById(folders: Folder[], targetId: string, prefix = ""): string | null {
  for (const f of folders) {
    const currentPath = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.id === targetId) return currentPath;
    if (f.folders) {
      const sub = getFolderPathById(f.folders, targetId, currentPath);
      if (sub) return sub;
    }
  }
  return null;
}

export function flattenNotes(folders: Folder[], docs: Note[]): Note[] {
  const out: Note[] = [...docs];
  function walk(fs: Folder[]) {
    for (const f of fs) {
      out.push(...f.documents);
      if (f.folders) walk(f.folders);
    }
  }
  walk(folders);
  return out;
}

export function folderOptions(folders: Folder[]): string[] {
  const opts: string[] = ["Root"];
  function walk(fs: Folder[], prefix = "") {
    for (const f of fs) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      opts.push(path);
      if (f.folders) walk(f.folders, path);
    }
  }
  walk(folders);
  return opts;
}

export function allPathsSet(folders: Folder[], rootDocs: Note[]): Set<string> {
  const s = new Set<string>();
  for (const d of rootDocs) s.add(d.path);
  function walk(fs: Folder[]) {
    for (const f of fs) {
      for (const d of f.documents) s.add(d.path);
      if (f.folders) walk(f.folders);
    }
  }
  walk(folders);
  return s;
}

export function isDuplicatePath(folders: Folder[], rootDocs: Note[], path: string): boolean {
  return allPathsSet(folders, rootDocs).has(path);
}

// Insert note into existing folder tree by folderPath (e.g. "docs/backend")
export function insertIntoFolderTree(folders: Folder[], folderPath: string, note: Note): Folder[] | null {
  let inserted = false;
  const next = folders.map((f) => {
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

// Remove document by id from folders+root
export function removeDocument(folders: Folder[], rootDocs: Note[], docId: string): { folders: Folder[]; rootDocs: Note[]; removed: Note | null } {
  let removed: Note | null = null;
  // Check root
  const newRoot = rootDocs.filter((d) => {
    if (d.id === docId) { removed = d; return false; }
    return true;
  });
  if (removed) return { folders, rootDocs: newRoot, removed };

  function walk(fs: Folder[]): Folder[] {
    return fs.map((f) => {
      const filtered = f.documents.filter((d) => {
        if (d.id === docId) { removed = d; return false; }
        return true;
      });
      const sub = f.folders ? walk(f.folders) : undefined;
      if (filtered.length !== f.documents.length || sub !== f.folders) {
        return { ...f, documents: filtered, folders: sub };
      }
      return f;
    });
  }
  const newFolders = walk(folders);
  return { folders: newFolders, rootDocs, removed };
}

// Insert document into destination (folderPath or Root)
export function insertDocumentAt(folders: Folder[], rootDocs: Note[], doc: Note, destPath: string | null): { folders: Folder[]; rootDocs: Note[] } {
  if (!destPath || destPath === "Root") {
    return { folders, rootDocs: [...rootDocs, doc].sort((a, b) => a.name.localeCompare(b.name)) };
  }
  const inserted = insertIntoFolderTree(folders, destPath, doc);
  if (inserted) return { folders: inserted, rootDocs };
  // Destination not found — fallback to root
  return { folders, rootDocs: [...rootDocs, doc].sort((a, b) => a.name.localeCompare(b.name)) };
}

export function moveDocument(
  folders: Folder[],
  rootDocs: Note[],
  docId: string,
  destPath: string | null,
): { folders: Folder[]; rootDocs: Note[]; moved: Note | null } {
  const { folders: afterRemove, rootDocs: afterRemoveRoot, removed } = removeDocument(folders, rootDocs, docId);
  if (!removed) return { folders, rootDocs, moved: null };
  const dest = destPath === "Root" ? null : destPath;
  const newPath = dest ? joinPath(dest, removed.name) : removed.name;
  const updated = updateDocumentPath(removed, newPath);
  // Check duplicate at destination
  const existing = allPathsSet(afterRemove, afterRemoveRoot);
  if (existing.has(newPath)) {
    // restore
    return { folders, rootDocs, moved: null };
  }
  const inserted = insertDocumentAt(afterRemove, afterRemoveRoot, updated, destPath);
  return { folders: inserted.folders, rootDocs: inserted.rootDocs, moved: updated };
}

export function renameDocument(
  folders: Folder[],
  rootDocs: Note[],
  docId: string,
  newNameRaw: string,
): { folders: Folder[]; rootDocs: Note[]; renamed: Note | null; error?: string } {
  const newName = ensureMarkdownSuffix(newNameRaw.trim());
  const validation = validateDocumentName(newName);
  if (validation) return { folders, rootDocs, renamed: null, error: validation };

  // Find doc
  const all = flattenNotes(folders, rootDocs);
  const target = all.find((d) => d.id === docId);
  if (!target) return { folders, rootDocs, renamed: null, error: "Document not found." };

  const parentPath = getParentPath(target.path);
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  // Duplicate check (exclude self)
  const paths = allPathsSet(folders, rootDocs);
  paths.delete(target.path);
  if (paths.has(newPath)) return { folders, rootDocs, renamed: null, error: "A document with that name already exists in this folder." };

  const updated = updateDocumentPath(target, newPath);

  // Replace in tree
  function replaceInFolders(fs: Folder[]): Folder[] {
    return fs.map((f) => {
      const docs = f.documents.map((d) => (d.id === docId ? updated : d));
      // keep sort
      const sorted = [...docs].sort((a, b) => a.name.localeCompare(b.name));
      const sub = f.folders ? replaceInFolders(f.folders) : undefined;
      return { ...f, documents: sorted, folders: sub };
    });
  }
  const newFolders = replaceInFolders(folders);
  const newRoot = rootDocs.map((d) => (d.id === docId ? updated : d)).sort((a, b) => a.name.localeCompare(b.name));
  // Determine which actually changed
  const renamed = updated;
  return { folders: newFolders, rootDocs: newRoot, renamed };
}

// Folder CRUD

export function createFolder(folders: Folder[], parentPath: string | null, name: string): { folders: Folder[]; error?: string } {
  const trimmed = name.trim();
  const validation = validateFolderName(trimmed);
  if (validation) return { folders, error: validation };

  const newFolder: Folder = { id: crypto.randomUUID(), name: trimmed, documents: [], folders: [] };

  if (!parentPath || parentPath === "Root") {
    if (folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      return { folders, error: "A folder with that name already exists." };
    }
    return { folders: [...folders, newFolder].sort((a, b) => a.name.localeCompare(b.name)) };
  }

  // Find parent
  const parent = findFolderByPath(folders, parentPath);
  if (!parent) return { folders, error: "Parent folder not found." };
  if ((parent.folders ?? []).some((f) => f.name.toLowerCase() === trimmed.toLowerCase()) || parent.documents.some(() => false)) {
    // check siblings
  }
  const siblings = parent.folders ?? [];
  if (siblings.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
    return { folders, error: "A folder with that name already exists." };
  }

  function insert(fs: Folder[], targetPath: string): Folder[] {
    return fs.map((f) => {
      const cur = f.name;
      if (targetPath === cur || targetPath.startsWith(cur + "/")) {
        const remainder = targetPath === cur ? "" : targetPath.slice(cur.length + 1);
        if (!remainder) {
          return { ...f, folders: [...(f.folders ?? []), newFolder].sort((a, b) => a.name.localeCompare(b.name)) };
        }
        if (f.folders) return { ...f, folders: insert(f.folders, remainder) };
      }
      return f;
    });
  }
  return { folders: insert(folders, parentPath) };
}

export function renameFolder(
  folders: Folder[],
  folderId: string,
  newNameRaw: string,
): { folders: Folder[]; error?: string; oldPath?: string; newPath?: string } {
  const newName = newNameRaw.trim();
  const validation = validateFolderName(newName);
  if (validation) return { folders, error: validation };

  const oldPath = getFolderPathById(folders, folderId);
  if (!oldPath) return { folders, error: "Folder not found." };
  const parentPath = getParentPath(oldPath);
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;

  // Duplicate check among siblings
  if (parentPath) {
    const parent = findFolderByPath(folders, parentPath);
    if (parent) {
      const siblings = (parent.folders ?? []).filter((f) => f.id !== folderId);
      if (siblings.some((f) => f.name.toLowerCase() === newName.toLowerCase())) return { folders, error: "A folder with that name already exists." };
    }
  } else {
    if (folders.some((f) => f.id !== folderId && f.name.toLowerCase() === newName.toLowerCase())) return { folders, error: "A folder with that name already exists." };
  }

  const oldPathStr = oldPath as string;
  const newPathStr = newPath as string;

  // Simpler: walk and when we hit target, rename with path updates; otherwise recurse.
  function walk(fs: Folder[]): Folder[] {
    return fs.map((f) => {
      if (f.id === folderId) {
        // update docs recursively
        const updateDocsDeep = (docs: Note[]): Note[] =>
          docs.map((d) => {
            if (d.path.startsWith(oldPathStr + "/") || d.path === oldPathStr) {
              const newDocPath = d.path.replace(oldPathStr, newPathStr);
              return updateDocumentPath(d, newDocPath);
            }
            return d;
          });
        const updateFoldersDeep = (subs: Folder[] | undefined): Folder[] | undefined => {
          if (!subs) return subs;
          return subs.map((sub) => ({
            ...sub,
            documents: updateDocsDeep(sub.documents),
            folders: updateFoldersDeep(sub.folders),
          }));
        };
        return { ...f, name: newName, documents: updateDocsDeep(f.documents), folders: updateFoldersDeep(f.folders) };
      }
      if (f.folders) {
        const sub = walk(f.folders);
        if (sub !== f.folders) return { ...f, folders: sub };
      }
      return f;
    });
  }

  const next = walk(folders).sort((a, b) => a.name.localeCompare(b.name));
  // Ensure top-level sort after rename; deeper levels preserve order but we can sort children too
  function sortAll(fs: Folder[]): Folder[] {
    return fs.map((f) => ({ ...f, folders: f.folders ? sortAll(f.folders).sort((a, b) => a.name.localeCompare(b.name)) : undefined })).sort((a, b) => a.name.localeCompare(b.name));
  }
  return { folders: sortAll(next), oldPath, newPath };
}

export function deleteFolder(folders: Folder[], folderId: string): { folders: Folder[]; removed: Folder | null } {
  let removed: Folder | null = null;
  function walk(fs: Folder[]): Folder[] {
    const out: Folder[] = [];
    for (const f of fs) {
      if (f.id === folderId) { removed = f; continue; }
      const sub = f.folders ? walk(f.folders) : undefined;
      out.push(sub !== f.folders ? { ...f, folders: sub } : f);
    }
    return out;
  }
  const next = walk(folders);
  return { folders: next, removed };
}

export function deleteDocumentFromTree(folders: Folder[], rootDocs: Note[], docId: string) {
  return removeDocument(folders, rootDocs, docId);
}

export function hasPendingChanges(folders: Folder[], rootDocs: Note[]): boolean {
  // Heuristic: we expose hasChanges flag externally; this helper not used for auto-detection
  return false;
}
