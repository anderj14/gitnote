import { NextResponse } from "next/server";
import { getGitHubClientFromSession } from "../_lib/session";

export async function GET() {
  const appSlug = process.env.GITHUB_APP_SLUG;
  const installUrl = appSlug
    ? `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`
    : null;
  const client = await getGitHubClientFromSession();

  if (!client) {
    return NextResponse.json({ connected: false, installUrl });
  }

  try {
    const account = await client.getAccount();

    return NextResponse.json({ connected: true, account, installUrl });
  } catch {
    return NextResponse.json(
      { connected: false, error: "Unable to load GitHub account.", installUrl },
      { status: 401 },
    );
  }
}
