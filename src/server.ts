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
    app.log.info(`📚 Swagger UI at http://localhost:${env.PORT}/docs`);
    app.log.info(`🔑 JWKS at http://localhost:${env.PORT}/api/v1/auth/.well-known/jwks.json`);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    await container.shutdown();
    process.exit(1);
  }
}

main();
