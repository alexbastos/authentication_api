// ─── Dependency Injection Container ───────────────────────────────────────
// Manual composition root — no DI framework needed

import { PrismaClient } from '@prisma/client';
import type { Env } from './infrastructure/config/env.js';

// Infrastructure
import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/repositories/prisma-refresh-token.repository.js';
import { PrismaClientAppRepository } from './infrastructure/database/repositories/prisma-client-app.repository.js';
import { RedisCacheProvider } from './infrastructure/cache/redis-cache.provider.js';
import { BcryptHasher } from './infrastructure/security/bcrypt-hasher.js';
import { JoseTokenManager } from './infrastructure/security/jose-token-manager.js';
import { GoogleOAuthProvider } from './infrastructure/social/google-oauth.provider.js';
import { SocialAuthProviderRegistry } from './infrastructure/social/social-auth-registry.js';

// Use Cases
import { AuthenticateUserUseCase } from './application/use-cases/auth/authenticate-user.use-case.js';
import { AuthenticateSocialUseCase } from './application/use-cases/auth/authenticate-social.use-case.js';
import { ValidateTokenUseCase } from './application/use-cases/auth/validate-token.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/refresh-token.use-case.js';
import { RevokeTokenUseCase } from './application/use-cases/auth/revoke-token.use-case.js';
import { RegisterUserUseCase } from './application/use-cases/user/register-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/user/get-user.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/user/update-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/user/delete-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/user/list-users.use-case.js';
import { RegisterClientAppUseCase } from './application/use-cases/client-app/register-client-app.use-case.js';
import { ListClientAppsUseCase } from './application/use-cases/client-app/list-client-apps.use-case.js';

// Controllers
import { AuthController } from './adapters/http/controllers/auth.controller.js';
import { UserController } from './adapters/http/controllers/user.controller.js';
import { ClientAppController } from './adapters/http/controllers/client-app.controller.js';

// Middleware
import { createAuthMiddleware } from './adapters/http/middlewares/auth.middleware.js';

export interface Container {
  // Infrastructure
  prisma: PrismaClient;
  redis: RedisCacheProvider;
  hasher: BcryptHasher;
  tokenManager: JoseTokenManager;
  socialRegistry: SocialAuthProviderRegistry;

  // Controllers
  authController: AuthController;
  userController: UserController;
  clientAppController: ClientAppController;

  // Middleware
  authMiddleware: ReturnType<typeof createAuthMiddleware>;

  // Lifecycle
  shutdown: () => Promise<void>;
}

export function createContainer(env: Env): Container {
  // ─── Infrastructure ─────────────────────────────────────────────────
  const prisma = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });

  const redis = new RedisCacheProvider({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
  });

  const hasher = new BcryptHasher(env.BCRYPT_SALT_ROUNDS);

  const tokenManager = new JoseTokenManager(
    env.JWT_PRIVATE_KEY_PATH,
    env.JWT_PUBLIC_KEY_PATH,
    env.JWT_ISSUER,
    env.JWT_ACCESS_TOKEN_EXPIRY,
  );

  // Social providers
  const socialRegistry = new SocialAuthProviderRegistry();
  if (env.GOOGLE_CLIENT_ID) {
    socialRegistry.register(new GoogleOAuthProvider(env.GOOGLE_CLIENT_ID));
  }

  // ─── Repositories ───────────────────────────────────────────────────
  const userRepository = new PrismaUserRepository(prisma);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
  const clientAppRepository = new PrismaClientAppRepository(prisma);

  // ─── Use Cases ──────────────────────────────────────────────────────
  const authenticateUserUC = new AuthenticateUserUseCase(
    userRepository, refreshTokenRepository, hasher, tokenManager, env.JWT_REFRESH_TOKEN_EXPIRY_DAYS,
  );
  const authenticateSocialUC = new AuthenticateSocialUseCase(
    userRepository, refreshTokenRepository, tokenManager, socialRegistry, env.JWT_REFRESH_TOKEN_EXPIRY_DAYS,
  );
  const validateTokenUC = new ValidateTokenUseCase(tokenManager, redis);
  const refreshTokenUC = new RefreshTokenUseCase(
    userRepository, refreshTokenRepository, tokenManager, env.JWT_REFRESH_TOKEN_EXPIRY_DAYS,
  );
  const revokeTokenUC = new RevokeTokenUseCase(refreshTokenRepository, tokenManager, redis);
  const registerUserUC = new RegisterUserUseCase(userRepository, hasher);
  const getUserUC = new GetUserUseCase(userRepository);
  const updateUserUC = new UpdateUserUseCase(userRepository, hasher);
  const deleteUserUC = new DeleteUserUseCase(userRepository, refreshTokenRepository);
  const listUsersUC = new ListUsersUseCase(userRepository);
  const registerClientAppUC = new RegisterClientAppUseCase(clientAppRepository);
  const listClientAppsUC = new ListClientAppsUseCase(clientAppRepository);

  // ─── Middleware ─────────────────────────────────────────────────────
  const authMiddleware = createAuthMiddleware(tokenManager, redis);

  // ─── Controllers ────────────────────────────────────────────────────
  const authController = new AuthController(
    authenticateUserUC, authenticateSocialUC, validateTokenUC,
    refreshTokenUC, revokeTokenUC, registerUserUC, tokenManager,
  );
  const userController = new UserController(getUserUC, updateUserUC, deleteUserUC, listUsersUC);
  const clientAppController = new ClientAppController(registerClientAppUC, listClientAppsUC);

  // ─── Shutdown ───────────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('[Container] Shutting down...');
    await prisma.$disconnect();
    await redis.disconnect();
    console.log('[Container] All connections closed');
  };

  return {
    prisma,
    redis,
    hasher,
    tokenManager,
    socialRegistry,
    authController,
    userController,
    clientAppController,
    authMiddleware,
    shutdown,
  };
}
