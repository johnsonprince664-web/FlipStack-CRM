import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const PRICE_MAP = {
  active_monthly:
    process.env.STRIPE_ACTIVE_MONTHLY_PRICE_ID ||
    process.env.STRIPE_PRICE_ACTIVE_MONTHLY ||
    process.env.STRIPE_ACTIVE_FLIPPER_MONTHLY_PRICE_ID,

  active_yearly:
    process.env.STRIPE_ACTIVE_YEARLY_PRICE_ID ||
    process.env.STRIPE_PRICE_ACTIVE_YEARLY ||
    process.env.STRIPE_ACTIVE_FLIPPER_YEARLY_PRICE_ID,

  apex_monthly:
    process.env.STRIPE_APEX_MONTHLY_PRICE_ID ||
    process.env.STRIPE_PRICE_APEX_MONTHLY,

  apex_yearly:
    process.env.STRIPE_APEX_YEARLY_PRICE_ID ||
    process.env.STRIPE_PRICE_APEX_YEARLY,

  active_flipper_monthly:
    process.env.STRIPE_ACTIVE_MONTHLY_PRICE_ID ||
    process.env.STRIPE_PRICE_ACTIVE_MONTHLY ||
    process.env.STRIPE_ACTIVE_FLIPPER_MONTHLY_PRICE_ID,

  active_flipper_yearly:
    process.env.STRIPE_ACTIVE_YEARLY_PRICE_ID ||
    process.env.STRIPE_PRICE_ACTIVE_YEARLY ||
    process.env.STRIPE_ACTIVE_FLIPPER_YEARLY_PRICE_ID,

  apex_power_monthly:
    process.env.STRIPE_APEX_MONTHLY_PRICE_ID ||
    process.env.STRIPE_PRICE_APEX_MONTHLY,

  apex_power_yearly:
    process.env.STRIPE_APEX_YEARLY_PRICE_ID ||
    process.env.STRIPE_PRICE_APEX_YEARLY,
} as const;

type PlanKey = keyof typeof PRICE_MAP;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = body.plan as PlanKey | undefined;

    if (!plan || !(plan in PRICE_MAP)) {
      return NextResponse.json(
        {
          error: "Invalid plan selected.",
          planReceived: body.plan,
          availablePlans: Object.keys(PRICE_MAP),
        },
        { status: 400 }
      );
    }

    const priceId = PRICE_MAP[plan];

    if (!priceId) {
      return NextResponse.json(
        {
          error: "Missing Stripe price ID for this plan.",
          planReceived: plan,
          availablePlans: Object.keys(PRICE_MAP),
        },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded" as any,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      return_url: `${siteUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        plan,
      },
      subscription_data: {
        metadata: {
          plan,
        },
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown Stripe error";

    console.error("Stripe checkout session error:", detail);

    return NextResponse.json(
      {
        error: "Could not create checkout session.",
        detail,
      },
      { status: 500 }
    );
  }
}