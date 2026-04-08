import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_PATH: z.string().default("./data/jarvis.db"),
  DATABASE_URL: z.string().default("file:./prisma/dev.db"),
  JWT_SECRET: z.string().default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
  REDIS_URL: z.string().default(""),
  AI_PROVIDER: z.enum(["groq", "openai"]).default("groq"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("EXAVITQu4vr4xnSDxMaL"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  MAX_INPUT_CHARS: z.coerce.number().int().min(200).max(20000).default(2000),
  MAX_RESPONSE_BYTES: z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(512 * 1024),
  AI_TIMEOUT_MS: z.coerce.number().int().min(2000).max(120000).default(25000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_FALLBACK_MESSAGE: z.string().default("I hit a temporary AI issue. Please retry in a moment."),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(5000).default(180),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  FEATURE_FLAGS: z.string().default("")
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") {
    return;
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-access-secret-change-me") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_SECRET"], message: "JWT_SECRET must be set to a strong production value" });
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-me") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_REFRESH_SECRET"], message: "JWT_REFRESH_SECRET must be set to a strong production value" });
  }

  if (value.AI_PROVIDER === "groq" && !value.GROQ_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["GROQ_API_KEY"], message: "GROQ_API_KEY is required when AI_PROVIDER=groq" });
  }

  if (value.AI_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["OPENAI_API_KEY"], message: "OPENAI_API_KEY is required when AI_PROVIDER=openai" });
  }
});

let env: z.infer<typeof envSchema>;

try {
  console.log("[env] Parsing environment variables...");
  env = envSchema.parse(process.env);
  console.log("[env] Environment variables parsed successfully");
  if (process.env.NODE_ENV === "production") {
    console.log("[env] Production mode detected");
    if (!process.env.DATABASE_URL) {
      console.warn("[env] WARNING: DATABASE_URL not explicitly set, using default SQLite file");
    }
  }
} catch (error) {
  console.error("[env] FATAL: Failed to parse environment variables");
  console.error("[env] Error details:", JSON.stringify(error, null, 2));
  throw error;
}

export { env };
