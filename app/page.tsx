import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="auth-page">
      <section className="card auth-card grid" style={{ width: "min(980px, 100%)" }}>
        <img
          className="logo-lockup"
          src="/assets/flipstack-app-lockup-transparent.png"
          alt="FlipStack"
        />

        <div>
          <p className="eyebrow">Production Reseller CRM</p>

          <h1
            style={{
              fontSize: "clamp(2.3rem, 7vw, 4.6rem)",
              lineHeight: 1,
              margin: "10px 0",
              letterSpacing: "-0.06em",
            }}
          >
            Run your reselling business from one clean dashboard.
          </h1>

          <p className="muted" style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
            FlipStack helps social resellers track inventory, buyers, deposits,
            bundles, hauls, shipping costs, profit, and customer ledgers without
            messy spreadsheets.
          </p>
        </div>

        <div className="metric-grid">
          <div className="card metric">
            <span>Inventory</span>
            <strong>Track flips</strong>
          </div>

          <div className="card metric">
            <span>Customers</span>
            <strong>Buyer ledgers</strong>
          </div>

          <div className="card metric">
            <span>Profit</span>
            <strong>Real numbers</strong>
          </div>

          <div className="card metric">
            <span>Shipping</span>
            <strong>Landed cost</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href="/signup">
            Start free
          </Link>

          <Link className="btn btn-secondary" href="/login">
            Log in
          </Link>

          <Link className="btn btn-secondary" href="/app">
            Open dashboard
          </Link>
        </div>

        <p className="muted">
          Start on the free Side Hustle plan, then upgrade when your inventory,
          buyers, and orders grow.
        </p>
      </section>
    </main>
  );
}
