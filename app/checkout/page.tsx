"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "active_monthly";

  const fetchClientSecret = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers,
      body: JSON.stringify({ plan }),
    });

    const json = await res.json();

    if (!json.clientSecret) {
      throw new Error(json.detail || json.error || "Missing Stripe client secret.");
    }

    return json.clientSecret;
  }, [plan]);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <main style={{ minHeight: "100vh", padding: "40px", background: "#061616", color: "white" }}>
        <h1>Stripe publishable key missing</h1>
        <p>Check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local and Vercel.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "40px 20px", background: "#061616", color: "white" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1>Finish your FlipStack upgrade</h1>
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
    <Suspense fallback={<p>Loading checkout.</p>}>
      <CheckoutContent />
    </Suspense>
  );
}
