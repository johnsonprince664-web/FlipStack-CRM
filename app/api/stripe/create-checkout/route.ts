import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromRequest } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const priceMap: Record<string, string | undefined> = {
  active_flipper_monthly: process.env.STRIPE_ACTIVE_FLIPPER_MONTHLY_PRICE_ID,
  active_flipper_yearly: process.env.STRIPE_ACTIVE_FLIPPER_YEARLY_PRICE_ID,
  apex_monthly: process.env.STRIPE_APEX_MONTHLY_PRICE_ID,
  apex_yearly: process.env.STRIPE_APEX_YEARLY_PRICE_ID
};

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const { plan, interval } = await req.json();
  const price = priceMap[`${plan}_${interval}`];

  if (!price) return NextResponse.json({ error: "Missing Stripe price ID for this plan." }, { status: 500 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email || undefined,
    line_items: [{ price, quantity: 1 }],
    success_url: `${siteUrl}/app?checkout=success`,
    cancel_url: `${siteUrl}/app?checkout=cancelled`,
    metadata: {
      user_id: user.id,
      plan
    }
  });

  return NextResponse.json({ url: session.url });
}
