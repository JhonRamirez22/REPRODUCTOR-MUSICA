import { z } from 'zod';

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().optional(),
    PGHOST: z.string().trim().min(1).optional(),
    PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
    PGDATABASE: z.string().trim().min(1).optional(),
    PGUSER: z.string().trim().min(1).optional(),
    AWS_REGION: z.string().trim().min(1).optional(),
    COOKIE_SECRET: z.string().min(32),
    YTMUSIC_PYTHON: z.string().trim().min(1).default('python3'),
    YTMUSIC_API_URL: z
      .string()
      .trim()
      .url()
      .refine((value) => {
        try {
          return new URL(value).protocol === 'https:';
        } catch {
          return false;
        }
      }, 'must use HTTPS')
      .optional(),
    YTMUSIC_API_TOKEN: z.string().min(32).optional(),
    JAMENDO_CLIENT_ID: z.string().trim().min(1).optional(),
    MAX_PLAYLISTS_PER_OWNER: z.coerce.number().int().positive().default(50),
    MAX_TRACKS_PER_PLAYLIST: z.coerce.number().int().positive().default(500),
    BODY_LIMIT_BYTES: z.coerce.number().int().positive().max(16_384).default(16_384),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  })
  .superRefine((config, context) => {
    const iamDatabaseValues = [config.PGHOST, config.PGDATABASE, config.PGUSER];
    const hasIamDatabaseValue = iamDatabaseValues.some((value) => value !== undefined);
    const hasCompleteIamDatabaseValues =
      iamDatabaseValues.every((value) => value !== undefined) && config.AWS_REGION !== undefined;

    if (config.DATABASE_URL && hasIamDatabaseValue) {
      context.addIssue({
        code: 'custom',
        message: 'Configure DATABASE_URL or the complete AWS IAM database settings, not both.',
        path: ['DATABASE_URL'],
      });
    }
    if (!config.DATABASE_URL && !hasCompleteIamDatabaseValues) {
      context.addIssue({
        code: 'custom',
        message: 'DATABASE_URL or PGHOST, PGDATABASE, PGUSER, and AWS_REGION are required.',
        path: ['DATABASE_URL'],
      });
    }
    if (Boolean(config.YTMUSIC_API_URL) !== Boolean(config.YTMUSIC_API_TOKEN)) {
      context.addIssue({
        code: 'custom',
        message: 'YTMUSIC_API_URL and YTMUSIC_API_TOKEN must be configured together.',
        path: ['YTMUSIC_API_URL'],
      });
    }
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
