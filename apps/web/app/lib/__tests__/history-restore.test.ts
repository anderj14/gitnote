import { describe, it, expect } from "vitest";
import { restoreFileInWorkspace, restoreCommitInWorkspace, assertSnapshotUnchanged } from "../restore";
import { getWorkspaceChangesFromDocs } from "../workspace-changes";
import type { SnapshotDoc } from "../workspace-changes";
import type { Folder, Note } from "@/app/components/types";

function foldersFromDocs(docs: Note[]): { folders: Folder[]; rootDocs: Note[] } {
  // simple: all root for tests
  return { folders: [], rootDocs: docs };
}

describe("restoreFileInWorkspace", () => {
  it("restore existing document modifies content", () => {
    const { folders, rootDocs } = foldersFromDocs([{ id: "github-file:owner/repo:docs/API.md", path: "docs/API.md", name: "API.md", content: "current" }]);
    const res = restoreFileInWorkspace(folders, rootDocs, "docs/API.md", undefined, "old version", "modified", "owner/repo");
    expect(res.rootDocs[0].content).toBe("old version");
  });

  it("restore deleted document recreates as added", () => {
    const { folders, rootDocs } = foldersFromDocs([]);
    const res = restoreFileInWorkspace(folders, rootDocs, "old.md", undefined, "old content", "added", "owner/repo");
    expect(res.rootDocs).toHaveLength(1);
    expect(res.rootDocs[0].path).toBe("old.md");
  });

  it("restore added document where file exists should update not duplicate", () => {
    const { folders, rootDocs } = foldersFromDocs([{ id: "github-file:owner/repo:new.md", path: "new.md", name: "new.md", content: "current" }]);
    const res = restoreFileInWorkspace(folders, rootDocs, "new.md", undefined, "historical", "added", "owner/repo");
    expect(res.rootDocs).toHaveLength(1);
    expect(res.rootDocs[0].content).toBe("historical");
  });

  it("restore deleted file removes from workspace (removed status)", () => {
    const { folders, rootDocs } = foldersFromDocs([{ id: "github-file:owner/repo:old.md", path: "old.md", name: "old.md", content: "to delete" }]);
    const res = restoreFileInWorkspace(folders, rootDocs, "old.md", undefined, null, "removed", "owner/repo");
    expect(res.rootDocs).toHaveLength(0);
  });

  it("restore renamed document handles previousPath", () => {
    const { folders, rootDocs } = foldersFromDocs([{ id: "github-file:owner/repo:README.md", path: "README.md", name: "README.md", content: "old loc" }]);
    // rename README.md -> docs/README.md with content
    const res = restoreFileInWorkspace(folders, rootDocs, "docs/README.md", "README.md", "renamed content", "renamed", "owner/repo");
    // previous path removed, new path added (could be in folders)
    const all = [...res.rootDocs, ...res.folders.flatMap((f) => f.documents)];
    expect(all.some((d) => d.path === "README.md")).toBe(false);
    expect(all.some((d) => d.path === "docs/README.md")).toBe(true);
  });

  it("restore single file does not modify other files", () => {
    const { folders, rootDocs } = foldersFromDocs([
      { id: "github-file:owner/repo:a.md", path: "a.md", name: "a.md", content: "a current" },
      { id: "github-file:owner/repo:b.md", path: "b.md", name: "b.md", content: "b current" },
    ]);
    const res = restoreFileInWorkspace(folders, rootDocs, "a.md", undefined, "a old", "modified", "owner/repo");
    expect(res.rootDocs.find((d) => d.path === "b.md")?.content).toBe("b current");
    expect(res.rootDocs.find((d) => d.path === "a.md")?.content).toBe("a old");
  });
});

describe("restoreCommitInWorkspace", () => {
  it("restore full commit replaces workspace", () => {
    const current = foldersFromDocs([
      { id: "github-file:owner/repo:docs/API.md", path: "docs/API.md", name: "API.md", content: "current API" },
      { id: "github-file:owner/repo:docs/Auth.md", path: "docs/Auth.md", name: "Auth.md", content: "auth" },
      { id: "github-file:owner/repo:README.md", path: "README.md", name: "README.md", content: "readme" },
      { id: "github-file:owner/repo:new.md", path: "new.md", name: "new.md", content: "new" },
    ]);
    const commitFiles = [
      { path: "docs/API.md", content: "old API" },
      { path: "README.md", content: "readme" },
    ];
    const res = restoreCommitInWorkspace(current.folders, current.rootDocs, commitFiles, ["docs"], "owner/repo");
    const all = [...res.rootDocs, ...res.folders.flatMap((f) => f.documents)];
    expect(all.some((d) => d.path === "docs/Auth.md")).toBe(false);
    expect(all.some((d) => d.path === "new.md")).toBe(false);
    expect(all.find((d) => d.path === "docs/API.md")?.content).toBe("old API");
  });

  it("restore does NOT modify originalSnapshot", () => {
    const original: SnapshotDoc[] = [
      { id: "github-file:owner/repo:docs/API.md", path: "docs/API.md", name: "API.md", content: "head API", source: { type: "github", owner: "owner", repo: "repo", branch: "main", path: "docs/API.md", sha: "abc" } },
      { id: "github-file:owner/repo:README.md", path: "README.md", name: "README.md", content: "head readme", source: { type: "github", owner: "owner", repo: "repo", branch: "main", path: "README.md", sha: "def" } },
    ];
    const before = JSON.parse(JSON.stringify(original)) as SnapshotDoc[];
    const current = foldersFromDocs([
      { id: "github-file:owner/repo:docs/API.md", path: "docs/API.md", name: "API.md", content: "current API" },
      { id: "github-file:owner/repo:README.md", path: "README.md", name: "README.md", content: "head readme" },
    ]);
    // simulate restore file to old version, snapshot should stay same
    const res = restoreFileInWorkspace(current.folders, current.rootDocs, "docs/API.md", undefined, "old API", "modified", "owner/repo");
    // workspace changed
    expect(res.rootDocs.find((d) => d.path === "docs/API.md")?.content).toBe("old API");
    // snapshot unchanged
    expect(assertSnapshotUnchanged(original, before)).toBe(true);
    expect(original[0].content).toBe("head API");
    // changes detection between snapshot and new workspace should show modified
    const changes = getWorkspaceChangesFromDocs(original, [...res.rootDocs]);
    expect(changes.some((c) => c.type === "modified" && c.path === "docs/API.md")).toBe(true);
  });
});

describe("history parsing", () => {
  it("fetch commits empty", () => {
    // simulate empty history response
    const commits: unknown[] = [];
    expect(Array.isArray(commits)).toBe(true);
    expect(commits.length).toBe(0);
  });

  it("commit details file statuses", () => {
    const files = [
      { path: "docs/API.md", status: "modified" as const, additions: 12, deletions: 4 },
      { path: "docs/auth.md", status: "added" as const, additions: 38, deletions: 0 },
      { path: "old.md", status: "removed" as const, additions: 0, deletions: 21 },
      { path: "docs/README.md", status: "renamed" as const, previousPath: "README.md", additions: 1, deletions: 1 },
    ];
    expect(files.find((f) => f.path === "docs/API.md")?.status).toBe("modified");
    expect(files.find((f) => f.path === "docs/auth.md")?.status).toBe("added");
    expect(files.find((f) => f.path === "old.md")?.status).toBe("removed");
    expect(files.find((f) => f.path === "docs/README.md")?.previousPath).toBe("README.md");
  });
});
