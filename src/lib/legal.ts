export const TERMS_VERSION = "2026-08-21.2";
export const PRIVACY_NOTICE_VERSION = "2026-08-21.2";

export const LEGAL_EFFECTIVE_DATE = "August 21, 2026";

export type LegalAcceptanceFields = {
  [key: string]: unknown;
  termsAcceptedAt?: unknown;
  termsVersion?: unknown;
  privacyAcknowledgedAt?: unknown;
  privacyNoticeVersion?: unknown;
};

export function hasCurrentLegalAcceptance(user: LegalAcceptanceFields): boolean {
  return user.termsVersion === TERMS_VERSION
    && user.privacyNoticeVersion === PRIVACY_NOTICE_VERSION
    && user.termsAcceptedAt instanceof Date
    && user.privacyAcknowledgedAt instanceof Date;
}

export function legalAcceptanceVersionKey(): string {
  return `${TERMS_VERSION}:${PRIVACY_NOTICE_VERSION}`;
}
