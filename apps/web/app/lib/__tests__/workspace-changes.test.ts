import { describe, it, expect } from "vitest";
import { getWorkspaceChangesFromDocs } from "../workspace-changes";
import type { SnapshotDoc } from "../workspace-changes";
import type { Note } from "@/app/components/types";

function snap(docs: { id: string; path: string; content: string }[]): SnapshotDoc[] {
  return docs.map((d) => ({ id: d.id, path: d.path, name: d.path.split("/").pop()!, content: d.content }));
}
function current(docs: { id: string; path: string; content: string }[]): Note[] {
  return docs.map((d) => ({ id: d.id, path: d.path, name: d.path.split("/").pop()!, content: d.content }));
}

describe("getWorkspaceChanges", () => {
  it("no changes when identical", () => {
    const orig = snap([{ id: "1", path: "docs/api.md", content: "# API" }]);
    const curr = current([{ id: "1", path: "docs/api.md", content: "# API" }]);
    expect(getWorkspaceChangesFromDocs(orig, curr)).toEqual([]);
  });

  it("modified same path different content", () => {
    const orig = snap([{ id: "1", path: "docs/api.md", content: "old" }]);
    const curr = current([{ id: "1", path: "docs/api.md", content: "new" }]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("modified");
    expect(changes[0].path).toBe("docs/api.md");
    expect(changes[0].oldContent).toBe("old");
    expect(changes[0].content).toBe("new");
  });

  it("added only current", () => {
    const orig = snap([]);
    const curr = current([{ id: "2", path: "docs/new-feature.md", content: "# New" }]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("added");
    expect(changes[0].path).toBe("docs/new-feature.md");
  });

  it("deleted only original", () => {
    const orig = snap([{ id: "1", path: "docs/old.md", content: "# Old" }]);
    const curr = current([]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("deleted");
    expect(changes[0].path).toBe("docs/old.md");
  });

  it("renamed same id different path", () => {
    const orig = snap([{ id: "1", path: "architecture.md", content: "# Arch" }]);
    const curr = current([{ id: "1", path: "docs/architecture.md", content: "# Arch" }]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("renamed");
    expect(changes[0].oldPath).toBe("architecture.md");
    expect(changes[0].path).toBe("docs/architecture.md");
    expect(changes[0].isModifiedAfterRename).toBe(false);
  });

  it("renamed + modified", () => {
    const orig = snap([{ id: "1", path: "architecture.md", content: "old" }]);
    const curr = current([{ id: "1", path: "docs/architecture.md", content: "new" }]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("renamed");
    expect(changes[0].isModifiedAfterRename).toBe(true);
    expect(changes[0].oldContent).toBe("old");
    expect(changes[0].content).toBe("new");
  });

  it("multiple changes M + A + D + R", () => {
    const orig = snap([
      { id: "1", path: "docs/api.md", content: "old api" },
      { id: "2", path: "old.md", content: "to delete" },
      { id: "3", path: "notes.md", content: "same" },
    ]);
    const curr = current([
      { id: "1", path: "docs/api.md", content: "new api" }, // modified
      { id: "3", path: "docs/notes.md", content: "same" }, // renamed
      { id: "4", path: "docs/auth.md", content: "new file" }, // added
    ]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(4);
    const types = changes.map((c) => c.type).sort();
    expect(types).toEqual(["added", "deleted", "modified", "renamed"].sort());
  });
});

describe("diff utility sanity", () => {
  it("empty", async () => {
    const { diffLines } = await import("../diff");
    expect(diffLines("", "")).toEqual([]);
    expect(diffLines("", "a\nb").map((l) => l.type)).toEqual(["added", "added"]);
    expect(diffLines("a\nb", "").map((l) => l.type)).toEqual(["removed", "removed"]);
  });
});

describe("getWorkspaceChanges extended", () => {
  it("source.path !== current path still detected as renamed via id", () => {
    const orig: SnapshotDoc[] = [
      { id: "1", path: "docs/API.md", name: "API.md", content: "old", source: { type: "github", owner: "o", repo: "r", branch: "main", path: "docs/API.md", sha: "abc" } },
    ];
    const curr: Note[] = [
      { id: "1", path: "backend/API.md", name: "API.md", content: "old", source: { type: "github", owner: "o", repo: "r", branch: "main", path: "docs/API.md", sha: "abc" } },
    ];
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("renamed");
    expect(changes[0].oldPath).toBe("docs/API.md");
    expect(changes[0].path).toBe("backend/API.md");
  });

  it("deleted preserves source and oldContent", () => {
    const orig: SnapshotDoc[] = [
      { id: "1", path: "old.md", name: "old.md", content: "gone", source: { type: "github", owner: "o", repo: "r", branch: "main", path: "old.md", sha: "sha1" } },
    ];
    const curr: Note[] = [];
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes[0].type).toBe("deleted");
    expect(changes[0].oldContent).toBe("gone");
    expect(changes[0].source?.sha).toBe("sha1");
  });

  it("added with no source", () => {
    const orig: SnapshotDoc[] = [];
    const curr: Note[] = [{ id: "x", path: "new.md", name: "new.md", content: "hello" }];
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes[0].type).toBe("added");
    expect(changes[0].content).toBe("hello");
  });

  it("renamed without modification is not modified", () => {
    const orig = snap([{ id: "1", path: "a.md", content: "same" }]);
    const curr = current([{ id: "1", path: "b.md", content: "same" }]);
    const changes = getWorkspaceChangesFromDocs(orig, curr);
    expect(changes[0].isModifiedAfterRename).toBe(false);
  });
});

describe("diffLines", () => {
  it("empty → content", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("", "hello\nworld");
    expect(lines.every((l) => l.type === "added")).toBe(true);
    expect(lines.map((l) => l.value)).toEqual(["hello", "world"]);
    expect(lines[0].newLineNumber).toBe(1);
  });

  it("content → empty", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("hello\nworld", "");
    expect(lines.every((l) => l.type === "removed")).toBe(true);
    expect(lines[0].oldLineNumber).toBe(1);
  });

  it("same content no diff", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("a\nb\nc", "a\nb\nc");
    expect(lines.every((l) => l.type === "unchanged")).toBe(true);
    expect(lines[0].oldLineNumber).toBe(1);
    expect(lines[0].newLineNumber).toBe(1);
  });

  it("single line modification", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("line1\nold\nline3", "line1\nnew\nline3");
    const types = lines.map((l) => l.type);
    expect(types).toContain("removed");
    expect(types).toContain("added");
    expect(lines.find((l) => l.value === "old")?.type).toBe("removed");
    expect(lines.find((l) => l.value === "new")?.type).toBe("added");
  });

  it("multiple line modification", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("a\nb\nc\nd", "a\nx\ny\nd");
    expect(lines.filter((l) => l.type === "removed").map((l) => l.value)).toEqual(["b", "c"]);
    expect(lines.filter((l) => l.type === "added").map((l) => l.value)).toEqual(["x", "y"]);
  });

  it("added lines", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("a\nc", "a\nb\nc");
    expect(lines.find((l) => l.value === "b")?.type).toBe("added");
    expect(lines.find((l) => l.value === "b")?.newLineNumber).toBe(2);
  });

  it("removed lines", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("a\nb\nc", "a\nc");
    expect(lines.find((l) => l.value === "b")?.type).toBe("removed");
    expect(lines.find((l) => l.value === "b")?.oldLineNumber).toBe(2);
  });

  it("large document fallback", async () => {
    const { diffLines } = await import("../diff");
    const bigOld = Array.from({ length: 5000 }, (_, i) => `old${i}`).join("\n");
    const bigNew = Array.from({ length: 5000 }, (_, i) => `new${i}`).join("\n");
    const lines = diffLines(bigOld, bigNew);
    // fallback: all removed then all added
    expect(lines.slice(0, 5000).every((l) => l.type === "removed")).toBe(true);
    expect(lines.slice(5000).every((l) => l.type === "added")).toBe(true);
    expect(lines).toHaveLength(10000);
  });

  it("line numbers correctness", async () => {
    const { diffLines } = await import("../diff");
    const lines = diffLines("a\nb\nc", "a\nb1\nc");
    const removed = lines.find((l) => l.value === "b")!;
    const added = lines.find((l) => l.value === "b1")!;
    expect(removed.type).toBe("removed");
    expect(removed.oldLineNumber).toBe(2);
    expect(added.type).toBe("added");
    expect(added.newLineNumber).toBe(2);
    const unchangedC = lines.find((l) => l.value === "c")!;
    expect(unchangedC.oldLineNumber).toBe(3);
    expect(unchangedC.newLineNumber).toBe(3);
  });
});
