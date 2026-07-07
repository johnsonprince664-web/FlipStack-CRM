import { NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_MAP = {
  active_monthly: "price_1TpyR2H1V3qPez5gT3DSGIOp",
  active_yearly: "price_1TpySLH1V3qPez5gr0mdvEiE",
  apex_monthly: "price_1TpyTDH1V3qPez5gWJDaCW8m",
  apex_yearly: "price_1TpyTrH1V3qPez5gFI13oARZ",

  active_flipper_monthly: "price_1TpyR2H1V3qPez5gT3DSGIOp",
  active_flipper_yearly: "price_1TpySLH1V3qPez5gr0mdvEiE",
  apex_power_monthly: "price_1TpyTDH1V3qPez5gWJDaCW8m",
  apex_power_yearly: "price_1TpyTrH1V3qPez5gFI13oARZ",
} as const;

type PlanKey = keyof typeof PRICE_MAP;

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

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

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page" as any,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
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