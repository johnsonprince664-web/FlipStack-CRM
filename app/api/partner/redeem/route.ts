import { NextResponse } from "next/server";
import { createAdminSupabase, getUserFromRequest } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { code } = await req.json();
  const partnerCode = process.env.PARTNER_ACCESS_CODE || "RESELLWITHPRINCE";
  const submittedCode = String(code || "").trim().toUpperCase();

  if (submittedCode !== partnerCode.toUpperCase()) {
    return NextResponse.json(
      { error: "Invalid partner code." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const updateWithPartnerColumns = {
    partner_access: true,
    partner_code_used: "RESELLWITHPRINCE",
    partner_access_expires_at: expiresAt.toISOString(),
    plan: "active_flipper",
    billing_status: "partner_comped",
    subscription_status: "partner_comped",
    account_status: "active",
    grace_started_at: null,
    downgraded_at: null,
    disabled_at: null,
    capacity_warning_reason: null,
    subscription_updated_at: new Date().toISOString()
  };

  let { error: updateError } = await supabase
    .from("profiles")
    .update(updateWithPartnerColumns)
    .eq("user_id", user.id);

  if (updateError) {
    const fallback = await supabase
      .from("profiles")
      .update({
        plan: "active_flipper",
        billing_status: "partner_comped",
        account_status: "active",
        grace_started_at: null,
        downgraded_at: null,
        disabled_at: null,
        capacity_warning_reason: null
      })
      .eq("user_id", user.id);

    updateError = fallback.error;
  }

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    plan: "active_flipper",
    expires_at: expiresAt.toISOString(),
  });
}
