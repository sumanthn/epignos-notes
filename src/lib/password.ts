import argon2 from "argon2";

const options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

let dummyHash: Promise<string> | undefined;

export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword("not-a-real-epinote-password");
  return dummyHash;
}

export function validatePassword(password: string, email: string): string | null {
  const length = Array.from(password).length;

  if (length < 12 || length > 128) {
    return "Use a password between 12 and 128 characters.";
  }

  const normalized = password.trim().toLowerCase();
  const emailName = email.split("@")[0];
  const common = new Set([
    "123456789012",
    "password1234",
    "qwertyuiop12",
    "letmeinplease",
  ]);

  if (common.has(normalized) || normalized === email || normalized === emailName) {
    return "Choose a less common password that is not based on your email.";
  }

  return null;
}
