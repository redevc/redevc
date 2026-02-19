import { z } from 'zod';

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string("Invalid BETTER_AUTH_SECRET").min(32).max(32),
  BETTER_AUTH_URL: z.string("Invalid BETTER_AUTH_URL").default("http://localhost:3333"),
  BETTER_AUTH_DOMAIN: z.string().optional(),

  DEFAULT_PORT: z.coerce.number("Invalid port").default(3333),

  // GITHUB_CLIENT_ID: z.string(),
  // GITHUB_CLIENT_SECRECT: z.string(),

  WEB_APP_URL: z.url(),
  WEB_DEV_URL: z.url(),
  WEB_URL: z.url(),

  MONGODB_URI: z.string().startsWith("mongodb+srv://"),
  MONGODB_DB_NAME: z.string(),

  AUDIO_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(524288000),
  AUDIO_UPLOAD_CHUNK_BYTES: z.coerce.number().int().positive().default(5242880),
  AUDIO_UPLOAD_TMP_DIR: z.string().default("/tmp/redevc-audio"),
  AUDIO_WORKER_POLL_MS: z.coerce.number().int().positive().default(3000),
  FFMPEG_PATH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
