import { NextRequest, NextResponse } from "next/server";
import { getCookieOptions, getRequiredGitHubEnv, githubCookieNames } from "../_lib/session";

type GitHubTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export async function GET(request: NextRequest) {
  const env = getRequiredGitHubEnv();

  if (!env) {
    return NextResponse.json(
      { error: "GitHub authentication is not configured." },
      { status: 500 },
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(githubCookieNames.oauthState)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?github=auth-error", request.nextUrl.origin));
  }

  const redirectUri = new URL("/api/github/callback", request.nextUrl.origin);
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: redirectUri.toString(),
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/?github=auth-error", request.nextUrl.origin));
  }

  const tokenJson = (await tokenResponse.json()) as GitHubTokenResponse;

  if (typeof tokenJson.access_token !== "string") {
    return NextResponse.redirect(new URL("/?github=auth-error", request.nextUrl.origin));
  }

  const response = NextResponse.redirect(new URL("/?github=connected", request.nextUrl.origin));
  const maxAge =
    typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 60 * 60 * 8;

  response.cookies.delete(githubCookieNames.oauthState);
  response.cookies.set(
    githubCookieNames.accessToken,
    tokenJson.access_token,
    getCookieOptions(maxAge),
  );

  return response;
}
