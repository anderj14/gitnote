import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@gitnote/github";
import { getGitHubClientFromSession } from "../_lib/session";

export async function GET() {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const repositories = await client.getRepositories();

    return NextResponse.json({ repositories });
  } catch {
    return NextResponse.json(
      { error: "Unable to load repositories." },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    private?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const isPrivate = body?.private !== false;

  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name) || name.length > 100) {
    return NextResponse.json(
      { error: "Invalid repository name. Use letters, numbers, -, _, ." },
      { status: 400 },
    );
  }

  try {
    const repository = await client.createRepository({
      name,
      private: isPrivate,
      autoInit: true,
    });

    return NextResponse.json({ repository }, { status: 201 });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const message =
        error.status === 422
          ? "Repository already exists or name is invalid."
          : error.status === 403
            ? "Missing scope 'repo'. Re-login to grant repository creation permission."
            : "Unable to create repository.";

      return NextResponse.json({ error: message, details: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to create repository." },
      { status: 502 },
    );
  }
}
