import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError } from "@gitnote/github";
import { getGitHubClientFromSession } from "../_lib/session";

export async function GET(request: NextRequest) {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  const path = request.nextUrl.searchParams.get("path");
  const ref = request.nextUrl.searchParams.get("ref");

  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !isMarkdownPath(path) || !ref) {
    return NextResponse.json({ error: "Invalid file parameters." }, { status: 400 });
  }

  try {
    const file = await client.getFile({ owner, repo, path, ref });

    return NextResponse.json({ file });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return NextResponse.json({ error: "Unable to load document." }, { status });
    }
    return NextResponse.json(
      { error: "Unable to load document." },
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
    owner?: unknown;
    repo?: unknown;
    path?: unknown;
    branch?: unknown;
    content?: unknown;
    message?: unknown;
  } | null;
  const owner = typeof body?.owner === "string" ? body.owner : null;
  const repo = typeof body?.repo === "string" ? body.repo : null;
  const path = typeof body?.path === "string" ? body.path : null;
  const branch = typeof body?.branch === "string" ? body.branch : null;
  const content = typeof body?.content === "string" ? body.content : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !isValidPath(path) || !branch || content === null) {
    return NextResponse.json({ error: "Invalid file parameters." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Commit message is required." }, { status: 400 });
  }
  if (content.length > 1_000_000) {
    return NextResponse.json({ error: "File is too large." }, { status: 400 });
  }
  try {
    const result = await client.createFile({ owner, repo, path, branch, content, message });
    return NextResponse.json({ file: { sha: result.sha, path: result.path } }, { status: 201 });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      console.error("GitHub createFile failed:", error.status, error.message);
      if (error.status === 422) {
        return NextResponse.json({ error: "File already exists." }, { status: 409 });
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: "You don't have permission to create this file." }, { status: error.status });
      }
      return NextResponse.json({ error: "Unable to create file." }, { status: 502 });
    }
    return NextResponse.json({ error: "Unable to create file." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    owner?: unknown;
    repo?: unknown;
    path?: unknown;
    branch?: unknown;
    sha?: unknown;
    content?: unknown;
    message?: unknown;
  } | null;

  const owner = typeof body?.owner === "string" ? body.owner : null;
  const repo = typeof body?.repo === "string" ? body.repo : null;
  const path = typeof body?.path === "string" ? body.path : null;
  const branch = typeof body?.branch === "string" ? body.branch : null;
  const sha = typeof body?.sha === "string" ? body.sha : null;
  const content = typeof body?.content === "string" ? body.content : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !isMarkdownPath(path) || !branch || !sha || content === null) {
    return NextResponse.json({ error: "Invalid file parameters." }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Commit message is required." }, { status: 400 });
  }

  if (content.length > 1_000_000) {
    return NextResponse.json({ error: "File is too large." }, { status: 400 });
  }

  try {
    const result = await client.updateFile({
      owner,
      repo,
      path,
      branch,
      sha,
      content,
      message,
    });

    return NextResponse.json({ file: { sha: result.sha, path: result.path } });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      // No log of stack trace to client — only friendly messages
      console.error("GitHub updateFile failed:", error.status, error.message);

      if (error.status === 409 || error.status === 422) {
        return NextResponse.json(
          { error: "This file changed on GitHub. Reload the file before saving again." },
          { status: 409 },
        );
      }

      if (error.status === 401 || error.status === 403) {
        const isIntegrationError = error.message.includes("Resource not accessible by integration");
        return NextResponse.json(
          {
            error: isIntegrationError
              ? "GitHub App lacks permission or is not installed on this repo. Enable 'Contents: Read & write' in GNoteio permissions and install it on gitnote-notes, then re-login."
              : "You don't have permission to modify this file.",
          },
          { status: error.status },
        );
      }

      if (error.status === 404) {
        return NextResponse.json(
          { error: "File not found on GitHub." },
          { status: 404 },
        );
      }

      // Network / unknown
      if (error.status >= 500) {
        return NextResponse.json(
          { error: "Unable to connect to GitHub." },
          { status: 502 },
        );
      }

      return NextResponse.json(
        { error: "Unable to save changes. Please try again." },
        { status: 502 },
      );
    }

    console.error("Unexpected updateFile error:", error);
    return NextResponse.json(
      { error: "Unable to save changes. Please try again." },
      { status: 502 },
    );
  }
}

function isSafeSegment(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value);
}

function isValidPath(value: string | null): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("..") && !value.startsWith("/") && value.length < 500;
}

export async function DELETE(request: NextRequest) {
  const client = await getGitHubClientFromSession();
  if (!client) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    owner?: unknown;
    repo?: unknown;
    path?: unknown;
    branch?: unknown;
    sha?: unknown;
    message?: unknown;
  } | null;
  const owner = typeof body?.owner === "string" ? body.owner : null;
  const repo = typeof body?.repo === "string" ? body.repo : null;
  const path = typeof body?.path === "string" ? body.path : null;
  const branch = typeof body?.branch === "string" ? body.branch : null;
  const sha = typeof body?.sha === "string" ? body.sha : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!isSafeSegment(owner) || !isSafeSegment(repo) || !isValidPath(path) || !branch || !sha) {
    return NextResponse.json({ error: "Invalid file parameters." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Commit message is required." }, { status: 400 });
  }
  try {
    await client.deleteFile({ owner, repo, path, sha, branch, message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      console.error("GitHub deleteFile failed:", error.status, error.message);
      if (error.status === 409 || error.status === 422) {
        return NextResponse.json({ error: "This file changed on GitHub. Reload the file before deleting it." }, { status: 409 });
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: "You don't have permission to delete this file." }, { status: error.status });
      }
      if (error.status === 404) {
        return NextResponse.json({ error: "File not found on GitHub." }, { status: 404 });
      }
      return NextResponse.json({ error: "Unable to delete file." }, { status: 502 });
    }
    return NextResponse.json({ error: "Unable to delete file." }, { status: 502 });
  }
}

function isMarkdownPath(value: string | null): value is string {
  if (!value || value.includes("..")) {
    return false;
  }

  const lowerValue = value.toLowerCase();

  return lowerValue.endsWith(".md") || lowerValue.endsWith(".markdown");
}
