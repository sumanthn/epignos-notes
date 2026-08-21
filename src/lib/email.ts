import { getEnv } from "./env";
import { LEGAL_EFFECTIVE_DATE } from "./legal";

type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character] || character);
}

export function legalNoticeEmail(
  displayName: string,
  appBaseUrl: string,
): Omit<TransactionalEmail, "to"> {
  const safeName = escapeHtml(displayName);
  const reviewUrl = `${appBaseUrl.replace(/\/$/u, "")}/legal-review`;
  return {
    subject: "Please review the EpiNote Terms and Privacy Notice",
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f6f8;color:#182033;font-family:Arial,sans-serif">
    <div style="max-width:620px;margin:0 auto;padding:40px 20px">
      <div style="background:#fff;border:1px solid #dfe3ea;border-radius:14px;padding:34px">
        <p style="margin:0;color:#4163c9;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">EpiNote Beta</p>
        <h1 style="margin:14px 0 0;font-family:Georgia,serif;font-size:30px;font-weight:500">A quick one-time review</h1>
        <p style="margin:18px 0 0;color:#536078;font-size:15px;line-height:1.7">Hello ${safeName},</p>
        <p style="margin:10px 0 0;color:#536078;font-size:15px;line-height:1.7">Please review the EpiNote Terms of Use and Privacy Notice effective ${LEGAL_EFFECTIVE_DATE}. You do not need to register again, and your existing notes are unchanged.</p>
        <p style="margin:24px 0"><a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#315cf5;color:#fff;font-size:14px;font-weight:700;text-decoration:none">Review and continue</a></p>
        <p style="margin:0;color:#768197;font-size:12px;line-height:1.6">Sign in to EpiNote before accepting. EpiNote will never treat clicking this email link alone as acceptance.</p>
      </div>
    </div>
  </body>
</html>`,
    text: `Hello ${displayName},\n\nPlease review the EpiNote Terms of Use and Privacy Notice effective ${LEGAL_EFFECTIVE_DATE}. You do not need to register again, and your existing notes are unchanged.\n\nReview and continue: ${reviewUrl}\n\nSign in to EpiNote before accepting. Clicking this email link alone does not count as acceptance.`,
  };
}

export async function sendTransactionalEmail(
  message: TransactionalEmail,
): Promise<{ id: string }> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    throw new EmailDeliveryError("Transactional email is not configured.", 503);
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new EmailDeliveryError("The email provider is unreachable.", 502);
  }

  const payload = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof payload?.id !== "string") {
    throw new EmailDeliveryError("The email provider rejected the message.", response.status || 502);
  }
  return { id: payload.id };
}
