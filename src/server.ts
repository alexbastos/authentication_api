// ─── Server Entry Point ───────────────────────────────────────────────────

import 'dotenv/config';
import { loadEnv } from './infrastructure/config/env.js';
import { createContainer } from './container.js';
import { buildApp } from './app.js';

async function main() {
  const env = loadEnv();
  const container = createContainer(env);
  const app = await buildApp(env, container);

  // ─── Graceful Shutdown ──────────────────────────────────────────────
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      await container.shutdown();
      process.exit(0);
    });
  }

  // ─── Start ──────────────────────────────────────────────────────────
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 Server running at http://${env.HOST}:${env.PORT}`);
    if (env.NODE_ENV !== 'production' || env.ENABLE_SWAGGER) {
      app.log.info(`📚 Swagger UI at http://localhost:${env.PORT}/docs/authentication_api`);
    }
    app.log.info(`🔑 JWKS at http://localhost:${env.PORT}/authentication_api/api/v1/auth/.well-known/jwks.json`);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    await container.shutdown();
    process.exit(1);
  }
}

// ─── Catch unhandled errors to prevent silent crashes ─────────────────────
process.on('unhandledRejection', () => {
  // Do not serialize arbitrary rejection values: they may contain credentials.
  console.error('[FATAL] Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', () => {
  console.error('[FATAL] Uncaught exception');
  process.exit(1);
});

main();
