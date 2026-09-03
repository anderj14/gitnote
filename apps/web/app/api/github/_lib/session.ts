import { cookies } from "next/headers";
import { GitHubClient } from "@gitnote/github";

const ACCESS_TOKEN_COOKIE = "gitnote_github_access_token";
const OAUTH_STATE_COOKIE = "gitnote_github_oauth_state";

export const githubCookieNames = {
  accessToken: ACCESS_TOKEN_COOKIE,
  oauthState: OAUTH_STATE_COOKIE,
} as const;

export function getCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

export async function getGitHubClientFromSession(): Promise<GitHubClient | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return new GitHubClient({ accessToken: token });
}

export function getRequiredGitHubEnv() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}
