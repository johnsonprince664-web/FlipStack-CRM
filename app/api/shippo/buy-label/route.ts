import { NextResponse } from "next/server";
import { createAdminSupabase, getUserFromRequest } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Missing SHIPPO_API_TOKEN" }, { status: 500 });

  const body = await req.json();

  if (!body.rate_id) {
    return NextResponse.json({ error: "Missing rate_id" }, { status: 400 });
  }

  const txRes = await fetch("https://api.goshippo.com/transactions/", {
    method: "POST",
    headers: {
      "Authorization": `ShippoToken ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rate: body.rate_id,
      label_file_type: body.label_file_type || "PDF",
      async: false
    })
  });

  const tx = await txRes.json();
  if (!txRes.ok) return NextResponse.json({ error: "Shippo label purchase failed", details: tx }, { status: 400 });

  const supabase = createAdminSupabase();
  await supabase.from("shipping_labels").insert({
    user_id: user.id,
    order_id: body.order_id || null,
    customer_id: body.customer_id || null,
    shippo_transaction_id: tx.object_id,
    carrier: tx.carrier_account || null,
    tracking_number: tx.tracking_number || null,
    tracking_url: tx.tracking_url_provider || null,
    label_url: tx.label_url || null,
    label_format: body.label_file_type || "PDF",
    amount: body.amount || null,
    status: tx.status || "created"
  });

  return NextResponse.json({ transaction: tx });
}
