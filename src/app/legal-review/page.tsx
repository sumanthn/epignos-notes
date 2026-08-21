import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LegalAcceptanceForm } from "@/components/LegalAcceptanceForm";
import { ProductWordmark } from "@/components/ProductWordmark";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import {
  getSessionUserByToken,
  sessionCookieName,
} from "@/lib/session";

import styles from "./legal-review.module.css";

export const metadata: Metadata = { title: "Review EpiNote terms" };
export const dynamic = "force-dynamic";

export default async function LegalReviewPage() {
  const cookieStore = await cookies();
  const user = await getSessionUserByToken(cookieStore.get(sessionCookieName())?.value);
  if (!user) redirect("/login");
  if (!user.legalAcceptanceRequired) {
    redirect(user.systemRole === "superadmin" ? "/admin" : "/workspace");
  }

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <ProductWordmark href="/" />
        <span>Signed in as {user.displayName}</span>
      </nav>
      <section className={styles.card}>
        <header>
          <p>One-time review</p>
          <h1>Before you continue</h1>
          <span>
            Existing EpiNote users need to review the documents effective {LEGAL_EFFECTIVE_DATE}.
            You do not need to register again, and your notes are unchanged.
          </span>
        </header>
        <LegalAcceptanceForm />
      </section>
    </main>
  );
}
