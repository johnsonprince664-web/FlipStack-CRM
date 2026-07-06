export default function CheckoutReturnPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <h1>Payment received</h1>
        <p>Your Flipstack subscription is being activated.</p>
        <a href="/dashboard">Go to dashboard</a>
      </div>
    </main>
  );
}
