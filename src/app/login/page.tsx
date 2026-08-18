import type { Metadata } from "next";

import { AuthForm } from "@/components/AuthForm";
import { ProductWordmark } from "@/components/ProductWordmark";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <ProductWordmark className="auth-wordmark" href="/" />
      <section className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to your notes</h1>
        <p className="auth-intro">Continue where your thinking left off.</p>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
