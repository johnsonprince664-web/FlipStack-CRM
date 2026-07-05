# FlipStack CRM — Production Build

This is no longer the static prototype. This is a production-style Next.js app wired for:

- Supabase email/password auth
- Supabase Postgres database + RLS
- Inventory CRUD
- Customer ledgers
- Bundles/orders/deposits
- Haul vault
- Selective landed cost allocation
- Plan limits and 30-day enforcement lifecycle
- Private founder access through environment variables
- Shippo label API routes
- Stripe subscription checkout + webhook skeleton
- Vercel cron endpoint for daily account enforcement

## Local setup

1. Install Node.js.
2. Run:

```bash
npm install
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Supabase setup

1. Create a Supabase project.
2. Go to SQL Editor.
3. Paste and run `supabase-schema.sql`.
4. Go to Authentication → Providers → Email and enable email/password.
5. Copy your Supabase Project URL and anon key into `.env.local`.

## Environment variables

Create `.env.local` using `.env.example`.

Important:
- Do not put server secrets in browser code.
- `FOUNDER_EMAIL` and `FOUNDER_ACCESS_CODE` stay private in Vercel/Supabase environment variables.
- `SHIPPO_API_TOKEN`, `STRIPE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are server-only.

## Shippo

The production flow is:
1. Create shipment.
2. Receive rates.
3. Create transaction from selected rate.
4. Save tracking and label URL to `shipping_labels`.

The current route is:
- `POST /api/shippo/rates`
- `POST /api/shippo/buy-label`

## Stripe

The production flow is:
1. Create Stripe products/prices for Active Flipper and Apex.
2. Put the Stripe price IDs into env vars.
3. Users click upgrade in Plans.
4. Stripe redirects them to Checkout.
5. Webhook updates their profile plan.

Webhook route:
- `/api/stripe/webhook`

## Founder data

1. Sign up in the app with your private founder email.
2. Go to Plans.
3. Enter your private founder code.
4. When founder access unlocks, click the seed button to put starter data on your account.

The app does not display the working email/code.

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import repo into Vercel.
3. Add all env vars.
4. Deploy.
5. Add the Stripe webhook URL in Stripe.
6. Test with Shippo test token first.


## Supabase Storage

Create a bucket named:

```text
inventory-images
```

For easiest first launch, set it to public so item images can load immediately. Later, switch to signed URLs and stricter policies for private storage.
