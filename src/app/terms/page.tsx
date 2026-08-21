import type { Metadata } from "next";
import Link from "next/link";

import { ProductWordmark } from "@/components/ProductWordmark";
import { LEGAL_EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <nav className="legal-nav" aria-label="Legal navigation">
        <ProductWordmark href="/" />
        <Link className="text-link" href="/register">Back to registration</Link>
      </nav>
      <article className="legal-document">
        <header>
          <p className="eyebrow">EpiNote Beta</p>
          <h1>Terms of Use</h1>
          <p>Effective {LEGAL_EFFECTIVE_DATE} · Version {TERMS_VERSION}</p>
        </header>

        <section>
          <h2>1. Your agreement</h2>
          <p>
            These terms apply when you create an account or use EpiNote at epignos.dev.
            Create an account only if you can legally enter this agreement. EpiNote is not
            intended for children under 18.
          </p>
        </section>

        <section>
          <h2>2. What EpiNote provides</h2>
          <p>
            EpiNote is a beta note-storage and knowledge-assistance service. It can store,
            organize, search, summarize, and connect material that you choose to add. Beta
            features may change, fail, or be withdrawn.
          </p>
        </section>

        <section>
          <h2>3. Your content and responsibility</h2>
          <p>
            You retain ownership of your content. You give EpiNote only the limited permission
            needed to host, process, transmit, back up, and display it to operate features you use.
            You are responsible for the content you add, its accuracy and legality, and for having
            all necessary rights and permissions.
          </p>
          <p>
            EpiNote does not review or endorse user content. You—not Epignos or epignos.dev—are
            responsible for decisions, publications, or actions based on your content or generated
            results.
          </p>
        </section>

        <section className="legal-callout">
          <h2>4. Do not store sensitive or regulated information</h2>
          <p>
            Do not use EpiNote as a password manager, secrets vault, payment system, medical
            record system, legal case-management system, or repository for government IDs.
            Do not add passwords, access tokens, API or private keys, payment-card data, health
            records, biometric data, or other regulated or highly confidential personal data.
          </p>
        </section>

        <section>
          <h2>5. Account security</h2>
          <p>
            Use a unique password, protect your devices and session, and tell EpiNote through
            the in-app Feedback feature if you suspect unauthorized access. You are responsible
            for activity performed through your account unless applicable law provides otherwise.
          </p>
        </section>

        <section>
          <h2>6. AI features</h2>
          <p>
            AI features are optional. When you request one, relevant content may be sent to a
            configured AI provider to produce the result. AI output can be incomplete, inaccurate,
            biased, or fabricated. Verify important claims and never rely on EpiNote output for
            medical, legal, financial, safety-critical, or other high-stakes decisions.
          </p>
        </section>

        <section>
          <h2>7. Acceptable use</h2>
          <p>You must not use EpiNote to:</p>
          <ul>
            <li>break the law, violate another person&apos;s rights, or upload content without permission;</li>
            <li>harass, exploit, defraud, threaten, or harm people;</li>
            <li>distribute malware or attempt to bypass, probe, or disrupt service security;</li>
            <li>access another user&apos;s account or content without authorization; or</li>
            <li>upload another person&apos;s secrets or sensitive data without a valid lawful basis.</li>
          </ul>
        </section>

        <section>
          <h2>8. Availability, exports, and backups</h2>
          <p>
            The beta service is provided on an as-available basis and does not promise uninterrupted
            operation, permanent retention, or error-free output. Keep independent copies of
            important information and use export where available. EpiNote may use operational
            backups, but they are not a substitute for your own copy.
          </p>
        </section>

        <section>
          <h2>9. Disclaimers and limits</h2>
          <p>
            To the maximum extent permitted by law, EpiNote is provided without implied warranties
            and Epignos is not liable for indirect, incidental, special, consequential, or lost-profit
            damages arising from use of the beta service, user content, or AI output. Nothing in these
            terms excludes responsibilities or liability that applicable law does not allow to be
            excluded.
          </p>
        </section>

        <section>
          <h2>10. Suspension and changes</h2>
          <p>
            Access may be limited or suspended to protect users, comply with law, address abuse, or
            maintain the service. Material changes to these terms will use a new version and should be
            presented before continued use when renewed acceptance is required.
          </p>
        </section>

        <section>
          <h2>11. Questions</h2>
          <p>
            Signed-in users can use Help → Feedback for questions about these terms. Also read the
            <Link href="/privacy"> Privacy Notice</Link> before creating an account.
          </p>
        </section>
      </article>
    </main>
  );
}
