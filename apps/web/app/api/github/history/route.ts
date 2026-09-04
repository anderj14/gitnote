import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@gitnote/github";
import { getGitHubClientFromSession } from "../_lib/session";

export async function GET(request: NextRequest) {
  const client = await getGitHubClientFromSession();
  if (!client) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  const branch = request.nextUrl.searchParams.get("branch");
  const path = request.nextUrl.searchParams.get("path");
  const perPageRaw = request.nextUrl.searchParams.get("perPage");

  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !branch) {
    return NextResponse.json({ error: "Invalid repository parameters." }, { status: 400 });
  }
  const perPage = perPageRaw ? Math.min(Math.max(parseInt(perPageRaw, 10) || 30, 1), 100) : 30;
  if (path && (!isValidPath(path) && path !== "")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  try {
    const commits = await client.getCommitHistory({
      owner,
      repo,
      branch,
      path: path ?? undefined,
      perPage,
    });
    return NextResponse.json({ commits });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return NextResponse.json({ error: "Unable to load commit history." }, { status });
    }
    return NextResponse.json({ error: "Unable to load commit history." }, { status: 502 });
  }
}

function isSafeSegment(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value);
}
function isValidPath(value: string | null): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("..") && !value.startsWith("/") && value.length < 500;
}
