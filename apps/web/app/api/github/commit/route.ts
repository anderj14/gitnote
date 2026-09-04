import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@gitnote/github";
import { getGitHubClientFromSession } from "../_lib/session";

type GitFileChangeInput = {
  type: "added" | "modified" | "deleted" | "renamed";
  path: string;
  oldPath?: string;
  content?: string;
  sha?: string;
};

export async function GET(request: NextRequest) {
  const client = await getGitHubClientFromSession();
  if (!client) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  const sha = request.nextUrl.searchParams.get("sha");
  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !sha || !/^[a-f0-9]{7,40}$/.test(sha)) {
    return NextResponse.json({ error: "Invalid commit parameters." }, { status: 400 });
  }
  try {
    const details = await client.getCommitDetails({ owner, repo, sha });
    return NextResponse.json({ commit: details });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return NextResponse.json({ error: "Unable to load commit details." }, { status });
    }
    return NextResponse.json({ error: "Unable to load commit details." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const client = await getGitHubClientFromSession();
  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    owner?: unknown;
    repo?: unknown;
    branch?: unknown;
    message?: unknown;
    changes?: unknown;
  } | null;

  const owner = typeof body?.owner === "string" ? body.owner : null;
  const repo = typeof body?.repo === "string" ? body.repo : null;
  const branch = typeof body?.branch === "string" ? body.branch : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const rawChanges = Array.isArray(body?.changes) ? (body.changes as unknown[]) : null;

  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !branch || !message || !rawChanges) {
    return NextResponse.json({ error: "Invalid commit parameters." }, { status: 400 });
  }
  if (rawChanges.length === 0) {
    return NextResponse.json({ error: "No changes to commit." }, { status: 400 });
  }
  if (rawChanges.length > 100) {
    return NextResponse.json({ error: "Too many changes." }, { status: 400 });
  }

  const changes: GitFileChangeInput[] = [];
  for (const item of rawChanges) {
    if (!item || typeof item !== "object") return NextResponse.json({ error: "Invalid change entry." }, { status: 400 });
    const c = item as Record<string, unknown>;
    const type = typeof c.type === "string" ? c.type : null;
    const path = typeof c.path === "string" ? c.path : null;
    if (!type || !["added", "modified", "deleted", "renamed"].includes(type) || !isValidPath(path)) {
      return NextResponse.json({ error: "Invalid change type or path." }, { status: 400 });
    }
    if (type === "renamed") {
      const oldPath = typeof c.oldPath === "string" ? c.oldPath : null;
      if (!isValidPath(oldPath)) return NextResponse.json({ error: "Invalid oldPath for renamed." }, { status: 400 });
    }
    if (type === "added" || type === "modified" || type === "renamed") {
      const content = typeof c.content === "string" ? c.content : "";
      if (content.length > 1_000_000) return NextResponse.json({ error: "File is too large." }, { status: 400 });
      changes.push({ type: type as GitFileChangeInput["type"], path: path!, oldPath: typeof c.oldPath === "string" ? c.oldPath : undefined, content, sha: typeof c.sha === "string" ? c.sha : undefined });
    } else {
      // deleted
      changes.push({ type: "deleted", path: path!, sha: typeof c.sha === "string" ? c.sha : undefined });
    }
  }

  try {
    const result = await client.commitChanges({ owner, repo, branch, message, changes });
    return NextResponse.json({ commitSha: result.commitSha });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      console.error("GitHub commitChanges failed:", error.status, error.message);
      if (error.status === 409 || error.status === 422) {
        return NextResponse.json({ error: "Some files changed on GitHub. Reload the repository before committing again." }, { status: 409 });
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: "You don't have permission to commit to this repository." }, { status: error.status });
      }
      return NextResponse.json({ error: "Unable to commit changes." }, { status: 502 });
    }
    console.error("Unexpected commitChanges error:", error);
    return NextResponse.json({ error: "Unable to commit changes." }, { status: 502 });
  }
}

function isSafeSegment(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value);
}
function isValidPath(value: string | null): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("..") && !value.startsWith("/") && value.length < 500;
}
