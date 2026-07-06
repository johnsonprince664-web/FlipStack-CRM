"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "active_monthly";

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();

    if (!data.clientSecret) {
      throw new Error(data.detail || data.error || "Missing Stripe client secret");
    }

    return data.clientSecret;
  }, [plan]);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <main style={{ minHeight: "100vh", padding: "40px", background: "#061616", color: "white" }}>
        <h1>Stripe publishable key missing</h1>
        <p>Check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "40px 20px", background: "#061616", color: "white" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1>Finish your Flipstack upgrade</h1>
        <p>Secure subscription checkout powered by Stripe.</p>

        <div style={{ marginTop: "32px" }}>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p>Loading checkout...</p>}>
      <CheckoutContent />
    </Suspense>
  );
}