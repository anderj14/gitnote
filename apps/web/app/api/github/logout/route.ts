import { NextResponse } from "next/server";
import { githubCookieNames } from "../_lib/session";

export function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete(githubCookieNames.accessToken);
  response.cookies.delete(githubCookieNames.oauthState);

  return response;
}
