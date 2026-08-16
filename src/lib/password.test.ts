import { describe, expect, it } from "vitest";

import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("password handling", () => {
  it("hashes and verifies without storing plaintext", async () => {
    const password = "a long useful passphrase";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, "the wrong password")).resolves.toBe(false);
  });

  it("enforces length and rejects email-derived passwords", () => {
    expect(validatePassword("too-short", "person@example.com")).toContain("12");
    expect(validatePassword("person", "person@example.com")).not.toBeNull();
    expect(validatePassword("a separate long passphrase", "person@example.com")).toBeNull();
  });
});
