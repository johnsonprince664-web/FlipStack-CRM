import { NextResponse } from "next/server";
import { createAdminSupabase, getUserFromRequest } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const { code } = await req.json();
  const founderEmail = process.env.FOUNDER_EMAIL;
  const founderCode = process.env.FOUNDER_ACCESS_CODE;

  if (!founderEmail || !founderCode) {
    return NextResponse.json({ error: "Founder access is not configured." }, { status: 500 });
  }

  if (user.email?.toLowerCase() !== founderEmail.toLowerCase() || code !== founderCode) {
    return NextResponse.json({ error: "Invalid access." }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      founder_access: true,
      plan: "apex",
      billing_status: "comped",
      account_status: "active",
      grace_started_at: null,
      downgraded_at: null,
      disabled_at: null,
      capacity_warning_reason: null
    })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
