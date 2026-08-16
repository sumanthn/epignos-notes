import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Link className="wordmark auth-wordmark" href="/">EpiNote</Link>
      <section className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to your notes</h1>
        <p className="auth-intro">Continue where your thinking left off.</p>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
