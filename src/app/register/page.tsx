import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <Link className="wordmark auth-wordmark" href="/">EpiNote</Link>
      <section className="auth-card">
        <p className="eyebrow">Your knowledge workspace</p>
        <h1>Start with one useful note</h1>
        <p className="auth-intro">A clean place to capture, organize, and return to your ideas.</p>
        <AuthForm mode="register" />
      </section>
    </main>
  );
}
