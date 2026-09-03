import { NextRequest, NextResponse } from "next/server";
import { getGitHubClientFromSession } from "../_lib/session";
import { getSupabaseClient, isSupabaseConfigured } from "@/app/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, preference: null });
  }

  const client = await getGitHubClientFromSession();
  if (!client) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const account = await client.getAccount().catch(() => null);
  if (!account) return NextResponse.json({ error: "Unable to load account." }, { status: 401 });

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ configured: false, preference: null });

  const { data, error } = await (supabase as any)
    .from("user_preferences")
    .select("selected_owner, selected_repo, selected_branch")
    .eq("github_user_id", account.id)
    .maybeSingle();

  if (error) {
    console.error("Supabase GET preference error:", error);
    return NextResponse.json({ error: "Unable to load preference." }, { status: 500 });
  }

  if (!data) return NextResponse.json({ configured: true, preference: null });

  return NextResponse.json({
    configured: true,
    preference: {
      owner: (data as any).selected_owner,
      repo: (data as any).selected_repo,
      branch: (data as any).selected_branch,
    },
  });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const client = await getGitHubClientFromSession();
  if (!client) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const account = await client.getAccount().catch(() => null);
  if (!account) return NextResponse.json({ error: "Unable to load account." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    owner?: unknown;
    repo?: unknown;
    branch?: unknown;
  } | null;

  const owner = typeof body?.owner === "string" ? body.owner.trim() : "";
  const repo = typeof body?.repo === "string" ? body.repo.trim() : "";
  const branch = typeof body?.branch === "string" ? body.branch.trim() : "main";

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required." }, { status: 400 });
  }

  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return NextResponse.json({ error: "Invalid owner/repo." }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { error } = await (supabase as any).from("user_preferences").upsert(
    {
      github_user_id: account.id,
      github_login: account.login,
      selected_owner: owner,
      selected_repo: repo,
      selected_branch: branch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "github_user_id" },
  );

  if (error) {
    console.error("Supabase PUT preference error:", error);
    return NextResponse.json({ error: "Unable to save preference." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true });

  const client = await getGitHubClientFromSession();
  if (!client) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const account = await client.getAccount().catch(() => null);
  if (!account) return NextResponse.json({ error: "Unable to load account." }, { status: 401 });

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: true });

  await (supabase as any).from("user_preferences").delete().eq("github_user_id", account.id);
  return NextResponse.json({ ok: true });
}
