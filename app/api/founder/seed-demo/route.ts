import { NextResponse } from "next/server";
import { createAdminSupabase, getUserFromRequest } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const supabase = createAdminSupabase();
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

  if (!profile?.founder_access) {
    return NextResponse.json({ error: "Founder access required." }, { status: 403 });
  }

  const { data: existing } = await supabase.from("customers").select("id").eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, message: "Starter data already exists." });
  }

  const { data: customers, error: customerError } = await supabase.from("customers").insert([
    { user_id: user.id, name: "Jay Bundle Buyer", instagram_handle: "jay.bundle", snapchat_handle: "jaycash", depop_handle: "jayfits", vouch_count: 2, total_spent: 220 },
    { user_id: user.id, name: "Mari Pre-Sold", instagram_handle: "mari.styles", snapchat_handle: "mari.snap", depop_handle: "mariscloset", vouch_count: 4, total_spent: 120 }
  ]).select();

  if (customerError) return NextResponse.json({ error: customerError.message }, { status: 400 });

  const jay = customers?.[0]?.id;
  const mari = customers?.[1]?.id;

  const { error: itemError } = await supabase.from("inventory_items").insert([
    { user_id: user.id, customer_id: jay, name: "2 Shorts + 2 Slides Bundle", brand: "Hellstar / Yeezy", category: "Bundle", size: "Mixed", status: "pre_sold", product_cost: 70.78, allocated_shipping_cost: 30.48, target_sale_price: 220, deposit_paid: 80 },
    { user_id: user.id, customer_id: mari, name: "Brainwashed Set", brand: "Hellstar", category: "Set", size: "M", status: "pre_sold", product_cost: 29.04, allocated_shipping_cost: 15.24, target_sale_price: 120, deposit_paid: 60 },
    { user_id: user.id, name: "VVS Hoodie", brand: "Sp5der", category: "Hoodie", size: "M", status: "available", product_cost: 20, allocated_shipping_cost: 7.62, target_sale_price: 120 },
    { user_id: user.id, name: "Arrow Tee", brand: "Off-White", category: "Tee", size: "M", status: "available", product_cost: 4.16, allocated_shipping_cost: 7.62, target_sale_price: 60 },
    { user_id: user.id, name: "Personal Brainwashed Set", brand: "Hellstar", category: "Set", size: "M", status: "personal_rotation", product_cost: 21.42, allocated_shipping_cost: 15.24, target_sale_price: 0 }
  ]);

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });

  await supabase.from("hauls").insert([
    { user_id: user.id, name: "First FlipStack Haul", agent_name: "Warehouse Agent", status: "warehouse", total_shipping_cost: 114.30, total_weight: 15, declared_value: 180, carrier: "EMS", destination_country: "United States" }
  ]);

  await supabase.from("bundles").insert([
    { user_id: user.id, customer_id: jay, name: "Jay — Shorts + Slides Bundle", bundle_price: 220, deposit_paid: 80, status: "hold" }
  ]);

  return NextResponse.json({ ok: true });
}
