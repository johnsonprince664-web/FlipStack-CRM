"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function SignupPage() {
  const supabase = createBrowserSupabase();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signup(e: FormEvent) {
    e.preventDefault();
    setMessage("Creating account...");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Account created. Check your email if confirmation is enabled, then log in.");
  }

  return (
    <main className="auth-page">
      <form className="card auth-card grid" onSubmit={signup}>
        <img className="logo-lockup" src="/assets/flipstack-app-lockup-transparent.png" alt="FlipStack" />
        <div>
          <p className="eyebrow">Start free</p>
          <h1>Create account</h1>
          <p className="muted">The free Side Hustle plan starts with 20 total account load.</p>
        </div>
        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} type="text" /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required /></label>
        <button className="btn btn-primary" type="submit">Create account</button>
        {message && <p className="muted">{message}</p>}
        <p className="muted">Already have one? <Link className="good" href="/login">Log in</Link></p>
      </form>
    </main>
  );
}
