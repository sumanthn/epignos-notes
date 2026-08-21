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
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  EMAIL_FROM: z.string().min(3).max(200).default("EpiNote <no-reply@notify.epignos.dev>"),
  OPENROUTER_API_KEY: z.string().min(20).optional(),
  OPENROUTER_MODEL: z.string().min(3).default("openai/gpt-oss-120b"),
  OPENROUTER_FAST_MODEL: z.string().min(3).default("google/gemini-3.6-flash"),
  OPENROUTER_LARGE_NOTE_MODEL: z.string().min(3).default("deepseek/deepseek-v4-pro"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (!cached) {
    cached = schema.parse(process.env);
  }

  return cached;
}
