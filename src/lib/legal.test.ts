import { describe, expect, it } from "vitest";

import {
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
  hasCurrentLegalAcceptance,
  legalAcceptanceVersionKey,
} from "./legal";

describe("legal acceptance", () => {
  it("accepts only the current versions with server dates", () => {
    expect(hasCurrentLegalAcceptance({
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      privacyAcknowledgedAt: new Date(),
    })).toBe(true);
  });

  it("requires review when a version or timestamp is missing", () => {
    expect(hasCurrentLegalAcceptance({
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    })).toBe(false);
    expect(hasCurrentLegalAcceptance({
      termsVersion: "older",
      termsAcceptedAt: new Date(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      privacyAcknowledgedAt: new Date(),
    })).toBe(false);
  });

  it("builds one stable key for notice idempotency", () => {
    expect(legalAcceptanceVersionKey()).toBe(`${TERMS_VERSION}:${PRIVACY_NOTICE_VERSION}`);
  });
});
