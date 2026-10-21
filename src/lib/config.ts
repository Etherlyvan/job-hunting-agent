import { z } from "zod";
export function config() {
  return z
    .object({
      DATABASE_URL: z.string().startsWith("postgresql://"),
      OPENAI_API_KEY: z.string().optional(),
      OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
      OPENAI_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(120000)
        .default(60000),
      APP_ACCESS_TOKEN: z.string().optional(),
      APP_ORIGIN: z.string().url().default("http://localhost:3000"),
    })
    .parse(process.env);
}
