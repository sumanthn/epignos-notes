import type { Metadata } from "next";
import Link from "next/link";

import { ProductWordmark } from "@/components/ProductWordmark";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_NOTICE_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <nav className="legal-nav" aria-label="Legal navigation">
        <ProductWordmark href="/" />
        <Link className="text-link" href="/register">Back to registration</Link>
      </nav>
      <article className="legal-document">
        <header>
          <p className="eyebrow">Plain-language notice</p>
          <h1>Privacy Notice</h1>
          <p>Effective {LEGAL_EFFECTIVE_DATE} · Version {PRIVACY_NOTICE_VERSION}</p>
        </header>

        <section className="legal-summary">
          <h2>The short version</h2>
          <ul>
            <li>EpiNote stores the account information and notes you choose to provide.</li>
            <li>It does not sell your personal information or use advertising trackers.</li>
            <li>Relevant note content is sent to an AI provider only when you request an AI feature.</li>
            <li>Do not put secrets or sensitive, regulated personal information in EpiNote.</li>
          </ul>
        </section>

        <section>
          <h2>1. Information EpiNote processes</h2>
          <ul>
            <li><strong>Account data:</strong> name, organization name, email address, password hash, account status, and acceptance records.</li>
            <li><strong>Your content:</strong> workspaces, Books, Notes, formatting, attachments when supported, and content-derived AI results.</li>
            <li><strong>Service and security data:</strong> session identifiers, expiry times, browser/user-agent information, privacy-preserving network hashes, request errors, and operational logs.</li>
            <li><strong>Feedback:</strong> bug reports, feature requests, and context you deliberately submit.</li>
            <li><strong>Browser data:</strong> an essential sign-in cookie plus local drafts and preferences stored on your device.</li>
          </ul>
          <p>EpiNote does not store your plain-text password.</p>
        </section>

        <section>
          <h2>2. Why the information is used</h2>
          <p>
            Information is used to create and secure accounts, store and retrieve Notes, provide
            features you request, preserve drafts, operate and troubleshoot the service, prevent
            abuse, respond to feedback, and comply with legal obligations.
          </p>
        </section>

        <section>
          <h2>3. AI processing</h2>
          <p>
            Ordinary writing and saving do not require AI. When you explicitly request organization,
            summaries, concept extraction, or another AI feature, EpiNote sends the relevant bounded
            content and instructions to its configured AI gateway and model provider. Provider
            processing may occur in another country and is subject to that provider&apos;s service terms.
            Do not submit sensitive information for AI processing.
          </p>
        </section>

        <section>
          <h2>4. Sharing</h2>
          <p>
            Information may be processed by infrastructure providers needed to host the application,
            database, network, transactional email, and—only when requested—AI features. The email
            provider receives the destination address and limited account-service message needed for
            delivery; EpiNote does not put Note content in those messages. EpiNote may also disclose
            limited information when legally required or necessary to protect users and the service.
            EpiNote does not sell personal information and does not share it for behavioral advertising.
          </p>
        </section>

        <section className="legal-callout">
          <h2>5. Sensitive information</h2>
          <p>
            EpiNote Beta is not designed for passwords, credentials, payment-card data, government
            identifiers, medical records, biometric data, legal privilege, or other regulated or
            highly confidential information. You are responsible for avoiding this material and for
            having permission and a lawful basis for personal information you add about other people.
          </p>
        </section>

        <section>
          <h2>6. Retention and deletion</h2>
          <p>
            Account and active Note data are retained while the account is active. Deleted Notes may
            first be archived for recovery and operational records may be retained for security and
            troubleshooting. Expired sessions are deleted automatically. Derived AI snapshots may be
            retained until their source Book or account is removed. Recovery copies, when enabled,
            may take additional time to expire.
          </p>
        </section>

        <section>
          <h2>7. Security</h2>
          <p>
            EpiNote uses HTTPS, one-way password hashing, secure HTTP-only session cookies, scoped
            organization/workspace access checks, and restricted service credentials. No internet
            service can guarantee absolute security, so do not use EpiNote as your only copy or as a
            vault for sensitive information.
          </p>
        </section>

        <section>
          <h2>8. Your choices and requests</h2>
          <p>
            You can edit and export Notes, delete individual Notes, choose whether to invoke AI, and
            sign out to end the current session. For access, correction, account deletion, or privacy
            questions, use Help → Feedback after signing in. Some requests may require identity
            verification and some records may need to be retained where law requires it.
          </p>
        </section>

        <section>
          <h2>9. Children</h2>
          <p>
            EpiNote is not intended for children under 18 and should not be used to collect children&apos;s
            personal information. If you believe a child&apos;s information was submitted, report it through
            the in-app Feedback feature.
          </p>
        </section>

        <section>
          <h2>10. Changes and questions</h2>
          <p>
            This notice will be updated when data practices materially change. The effective date and
            version appear at the top. Signed-in users can use Help → Feedback for privacy questions.
            Also read the <Link href="/terms">Terms of Use</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
