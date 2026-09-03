import { NextRequest, NextResponse } from "next/server";
import { getGitHubClientFromSession } from "../_lib/session";

export async function GET(request: NextRequest) {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  const branch = request.nextUrl.searchParams.get("branch");

  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !branch) {
    return NextResponse.json({ error: "Invalid repository parameters." }, { status: 400 });
  }

  try {
    const tree = await client.getRepositoryTree({ owner, repo, branch });

    return NextResponse.json({ tree });
  } catch {
    return NextResponse.json(
      { error: "Unable to load repository files." },
      { status: 502 },
    );
  }
}

function isSafeSegment(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value);
}
