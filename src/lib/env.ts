import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const schema = z.object({
  APP_BASE_URL: z.url(),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default("epignos_dev"),
  AUTH_REQUIRE_EMAIL_VERIFICATION: booleanString.default(false),
  COOKIE_SECURE: booleanString.default(false),
  AUTH_HMAC_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (!cached) {
    cached = schema.parse(process.env);
  }

  return cached;
}
