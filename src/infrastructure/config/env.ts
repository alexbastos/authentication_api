// ─── Environment Configuration ────────────────────────────────────────────

import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // JWT
  JWT_PRIVATE_KEY_PATH: z.string().default('./keys/private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('./keys/public.pem'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),
  JWT_ISSUER: z.string().default('authentication-api'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  // Frontend URL (used for email links — must point to the frontend app, NOT the API)
  APP_URL: z.string().default('http://localhost:3001'),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['console', 'ses']).default('console'),
  EMAIL_FROM_ADDRESS: z.string().default('capcodesolucoes@gmail.com'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ENDPOINT_URL: z.string().optional(),

  // Email Verification
  VERIFICATION_TOKEN_EXPIRY_HOURS: z.coerce.number().default(24),

  // Password Reset
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS: z.coerce.number().default(1),

  // Brute Force Protection
  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().default(15),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
