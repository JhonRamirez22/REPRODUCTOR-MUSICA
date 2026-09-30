import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  COOKIE_SECRET: z.string().min(32),
  MAX_PLAYLISTS_PER_OWNER: z.coerce.number().int().positive().default(50),
  MAX_TRACKS_PER_PLAYLIST: z.coerce.number().int().positive().default(500),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().max(16_384).default(16_384),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
});

export type AppConfig = z.infer<typeof EnvironmentSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvironmentSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration: ${issues.join('; ')}`);
  }
  return result.data;
}
