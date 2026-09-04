import type { Folder, Note } from "@/app/components/types";
import { flattenNotes } from "./workspace";

export type ChangeType = "modified" | "added" | "deleted" | "renamed";

export type WorkspaceChange = {
  id: string;
  type: ChangeType;
  path: string;
  oldPath?: string;
  name: string;
  oldContent?: string;
  content?: string;
  source?: Note["source"];
  isModifiedAfterRename?: boolean;
};

// Snapshot doc — original state from GitHub
export type SnapshotDoc = {
  id: string;
  path: string;
  name: string;
  content: string;
  source?: Note["source"];
};

export type OriginalSnapshot = SnapshotDoc[];

export function getWorkspaceChanges(
  originalDocs: OriginalSnapshot,
  folders: Folder[],
  rootDocs: Note[]
): WorkspaceChange[] {
  const currentDocs = flattenNotes(folders, rootDocs);
  return getWorkspaceChangesFromDocs(originalDocs, currentDocs);
}

export function getWorkspaceChangesFromDocs(
  originalDocs: SnapshotDoc[],
  currentDocs: Note[]
): WorkspaceChange[] {
  const originalById = new Map<string, SnapshotDoc>();
  for (const doc of originalDocs) {
    originalById.set(doc.id, doc);
  }
  const currentById = new Map<string, Note>();
  for (const doc of currentDocs) {
    currentById.set(doc.id, doc);
  }

  const changes: WorkspaceChange[] = [];

  // Detect added, modified, renamed
  for (const current of currentDocs) {
    const original = originalById.get(current.id);
    if (!original) {
      // No original → added (new doc created locally)
      changes.push({
        id: current.id,
        type: "added",
        path: current.path,
        name: current.name,
        content: current.content,
        source: current.source,
      });
      continue;
    }

    const pathChanged = original.path !== current.path;
    const contentChanged = (original.content ?? "") !== (current.content ?? "");

    if (pathChanged) {
      changes.push({
        id: current.id,
        type: "renamed",
        path: current.path,
        oldPath: original.path,
        name: current.name,
        oldContent: original.content,
        content: current.content,
        source: original.source,
        isModifiedAfterRename: contentChanged,
      });
    } else if (contentChanged) {
      changes.push({
        id: current.id,
        type: "modified",
        path: current.path,
        name: current.name,
        oldContent: original.content,
        content: current.content,
        source: original.source ?? current.source,
      });
    }
    // else unchanged → no change
  }

  // Detect deleted
  for (const original of originalDocs) {
    if (!currentById.has(original.id)) {
      changes.push({
        id: original.id,
        type: "deleted",
        path: original.path,
        name: original.name,
        oldContent: original.content,
        source: original.source,
      });
    }
  }

  // Sort: renamed, modified, added, deleted — then by path
  const order: Record<ChangeType, number> = {
    renamed: 0,
    modified: 1,
    added: 2,
    deleted: 3,
  };
  changes.sort((a, b) => {
    const oa = order[a.type];
    const ob = order[b.type];
    if (oa !== ob) return oa - ob;
    return a.path.localeCompare(b.path);
  });

  return changes;
}

export function snapshotFromFolders(
  folders: Folder[],
  rootDocs: Note[]
): OriginalSnapshot {
  const docs = flattenNotes(folders, rootDocs);
  return docs.map((d) => ({
    id: d.id,
    path: d.path,
    name: d.name,
    content: d.content,
    source: d.source ? { ...d.source } : undefined,
  }));
}

export function snapshotFromDocs(docs: Note[]): OriginalSnapshot {
  return docs.map((d) => ({
    id: d.id,
    path: d.path,
    name: d.name,
    content: d.content,
    source: d.source ? { ...d.source } : undefined,
  }));
}
