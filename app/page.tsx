import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="auth-page">
      <section className="card auth-card grid">
        <img className="logo-lockup" src="/assets/flipstack-app-lockup-transparent.png" alt="FlipStack" />
        <div>
          <p className="eyebrow">Production CRM</p>
          <h1 style={{fontSize: "clamp(2.2rem, 7vw, 4rem)", lineHeight: 1, margin: "8px 0"}}>
            Resell inventory, customers, hauls, bundles, and labels.
          </h1>
          <p className="muted">
            FlipStack is a phone-first command center for social resellers: buyer ledgers,
            active holds, landed cost math, plan limits, Shippo labels, and account enforcement.
          </p>
        </div>
        <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
          <Link className="btn btn-primary" href="/signup">Start free</Link>
          <Link className="btn btn-secondary" href="/login">Log in</Link>
          <Link className="btn btn-secondary" href="/app">Open app</Link>
        </div>
      </section>
    </main>
  );
}
