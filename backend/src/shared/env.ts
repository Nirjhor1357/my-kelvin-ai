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
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
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
