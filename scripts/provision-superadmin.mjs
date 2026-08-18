import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import argon2 from "argon2";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";

process.umask(0o077);

const envSchema = z
  .object({
    MONGODB_URI: z.string().min(1),
    MONGODB_DB: z.string().min(1),
    SUPERADMIN_EMAIL: z.string().trim().toLowerCase().email().max(254),
    SUPERADMIN_DISPLAY_NAME: z.string().trim().min(2).max(80).default("EpiNote Super Admin"),
    SUPERADMIN_PASSWORD: z.string().min(12).max(128).optional(),
    SUPERADMIN_GENERATE_PASSWORD_FILE: z.string().min(1).optional(),
  })
  .refine(
    (value) => Boolean(value.SUPERADMIN_PASSWORD) !== Boolean(value.SUPERADMIN_GENERATE_PASSWORD_FILE),
    "Set exactly one of SUPERADMIN_PASSWORD or SUPERADMIN_GENERATE_PASSWORD_FILE.",
  )
  .refine(
    (value) => !value.SUPERADMIN_GENERATE_PASSWORD_FILE || isAbsolute(value.SUPERADMIN_GENERATE_PASSWORD_FILE),
    "SUPERADMIN_GENERATE_PASSWORD_FILE must be an absolute path.",
  );

const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

async function provision() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
        .join(" "),
    );
  }

  const config = parsed.data;
  const client = new MongoClient(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    await client.connect();
    const db = client.db(config.MONGODB_DB);
    const users = db.collection("users");

    await users.createIndexes([
      { key: { emailNormalized: 1 }, name: "users_email_unique", unique: true },
      {
        key: { systemRole: 1 },
        name: "users_single_superadmin",
        unique: true,
        partialFilterExpression: { systemRole: "superadmin" },
      },
    ]);

    const existingAdmin = await users.findOne({ systemRole: "superadmin" });
    if (existingAdmin) {
      if (existingAdmin.emailNormalized !== config.SUPERADMIN_EMAIL) {
        throw new Error("A different superadmin account already exists.");
      }
      process.stdout.write(`${JSON.stringify({ status: "exists", email: config.SUPERADMIN_EMAIL })}\n`);
      return;
    }

    const existingUser = await users.findOne({ emailNormalized: config.SUPERADMIN_EMAIL });
    if (existingUser) {
      throw new Error("That email already belongs to a regular user; refusing to promote it implicitly.");
    }

    const password = config.SUPERADMIN_PASSWORD ?? randomBytes(32).toString("base64url");
    const passwordHash = await argon2.hash(password, passwordOptions);
    const now = new Date();

    let credentialFileWritten = false;
    if (config.SUPERADMIN_GENERATE_PASSWORD_FILE) {
      await writeFile(
        config.SUPERADMIN_GENERATE_PASSWORD_FILE,
        `${JSON.stringify({ email: config.SUPERADMIN_EMAIL, password }, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      credentialFileWritten = true;
    }

    try {
      await users.insertOne({
        _id: new ObjectId(),
        schemaVersion: 1,
        email: config.SUPERADMIN_EMAIL,
        emailNormalized: config.SUPERADMIN_EMAIL,
        passwordHash,
        displayName: config.SUPERADMIN_DISPLAY_NAME,
        status: "active",
        systemRole: "superadmin",
        emailVerifiedAt: now,
        passwordChangedAt: now,
        authVersion: 1,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        disabledAt: null,
      });
    } catch (error) {
      if (credentialFileWritten && config.SUPERADMIN_GENERATE_PASSWORD_FILE) {
        await unlink(config.SUPERADMIN_GENERATE_PASSWORD_FILE).catch(() => undefined);
      }
      throw error;
    }

    process.stdout.write(`${JSON.stringify({
      status: "created",
      email: config.SUPERADMIN_EMAIL,
      credentialFile: config.SUPERADMIN_GENERATE_PASSWORD_FILE ?? null,
    })}\n`);
  } finally {
    await client.close();
  }
}

provision().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown provisioning failure.";
  process.stderr.write(`${JSON.stringify({ status: "error", error: message })}\n`);
  process.exitCode = 1;
});
