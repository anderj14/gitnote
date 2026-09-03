import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCookieOptions, getRequiredGitHubEnv, githubCookieNames } from "../_lib/session";

export function GET(request: NextRequest) {
  const env = getRequiredGitHubEnv();

  if (!env) {
    return NextResponse.json(
      { error: "GitHub authentication is not configured." },
      { status: 500 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/github/callback", request.nextUrl.origin);
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");

  authorizeUrl.searchParams.set("client_id", env.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri.toString());
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "repo");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(githubCookieNames.oauthState, state, getCookieOptions(600));

  return response;
}
