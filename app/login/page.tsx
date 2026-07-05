"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function login(e: FormEvent) {
    e.preventDefault();
    setMessage("Logging in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.href = "/app";
  }

  return (
    <main className="auth-page">
      <form className="card auth-card grid" onSubmit={login}>
        <img className="logo-lockup" src="/assets/flipstack-app-lockup-transparent.png" alt="FlipStack" />
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Log in</h1>
          <p className="muted">Use your FlipStack email and password.</p>
        </div>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
        <button className="btn btn-primary" type="submit">Log in</button>
        {message && <p className="muted">{message}</p>}
        <p className="muted">Need an account? <Link className="good" href="/signup">Sign up</Link></p>
      </form>
    </main>
  );
}
