// ─── Environment Configuration ────────────────────────────────────────────

import { z } from 'zod';

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return value;
}, z.boolean());

const optionalEncryptionKey = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
);

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: booleanFromString.default(false),
  ENABLE_SWAGGER: booleanFromString.default(false),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_TLS: booleanFromString.default(false),

  // JWT
  JWT_PRIVATE_KEY_PATH: z.string().default('./keys/private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('./keys/public.pem'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().regex(/^\d+[smhd]$/).default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  JWT_ISSUER: z.string().default('authentication-api'),
  JWT_AUDIENCE: z.string().default('authentication-api'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Frontend URL (used for email links — must point to the frontend app, NOT the API)
  APP_URL: z.string().default('http://localhost:3001'),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['console', 'ses']).default('console'),
  EMAIL_FROM_ADDRESS: z.string().default('capcodesolucoes@gmail.com'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ENDPOINT_URL: z.string().optional(),

  // Email Verification
  VERIFICATION_TOKEN_EXPIRY_HOURS: z.coerce.number().int().min(1).max(168).default(24),

  // Password Reset
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS: z.coerce.number().int().min(1).max(24).default(1),

  // Brute Force Protection
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

  // MFA / 2FA
  MFA_ISSUER_NAME: z.string().default('AuthenticationAPI'),
  MFA_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  MFA_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  DATA_ENCRYPTION_KEY: optionalEncryptionKey,

  // Avatar / S3 Storage
  S3_AVATAR_BUCKET: z.string().default('authentication-api-avatars'),
  AVATAR_MAX_SIZE_MB: z.coerce.number().int().min(1).max(20).default(5),
}).superRefine((env, context) => {
  if (env.NODE_ENV === 'production' && !env.DATA_ENCRYPTION_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATA_ENCRYPTION_KEY'],
      message: 'Required in production to encrypt MFA and webhook secrets at rest',
    });
  }
  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN.split(',').map((value) => value.trim()).includes('*')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGIN'], message: 'Wildcard CORS is forbidden in production' });
  }
  if (env.NODE_ENV === 'production' && env.EMAIL_PROVIDER === 'console') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_PROVIDER'], message: 'Console email provider is forbidden in production' });
  }
  if (env.NODE_ENV === 'production' && !env.REDIS_PASSWORD) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['REDIS_PASSWORD'], message: 'Redis authentication is required in production' });
  }
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
