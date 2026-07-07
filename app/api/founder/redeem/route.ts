import { NextResponse } from "next/server";
import { createAdminSupabase, getUserFromRequest } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { code } = await req.json();

  const founderEmail = process.env.FOUNDER_EMAIL;
  const founderCode = process.env.FOUNDER_ACCESS_CODE;
  const partnerCode = process.env.PARTNER_ACCESS_CODE || "RESELLWITHPRINCE";

  const submittedCode = String(code || "").trim().toUpperCase();

  const supabase = createAdminSupabase();

  if (
    founderEmail &&
    founderCode &&
    user.email?.toLowerCase() === founderEmail.toLowerCase() &&
    submittedCode === founderCode.toUpperCase()
  ) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        founder_access: true,
        plan: "apex_power",
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

    return NextResponse.json({ ok: true, access: "founder", plan: "apex_power" });
  }

  if (submittedCode === partnerCode.toUpperCase()) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        plan: "active_flipper",
        billing_status: "partner_comped",
        account_status: "active",
        capacity_warning_reason: null,
        grace_started_at: null,
        downgraded_at: null,
        disabled_at: null
      })
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      access: "partner",
      plan: "active_flipper",
      expires_at: expiresAt.toISOString()
    });
  }

  return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
}
