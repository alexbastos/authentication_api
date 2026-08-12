// ─── Dependency Injection Container ───────────────────────────────────────
// Manual composition root — no DI framework needed

import { PrismaClient } from '@prisma/client';
import type { Env } from './infrastructure/config/env.js';

// Infrastructure
import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/repositories/prisma-refresh-token.repository.js';
import { PrismaClientAppRepository } from './infrastructure/database/repositories/prisma-client-app.repository.js';
import { PrismaVerificationTokenRepository } from './infrastructure/database/repositories/prisma-verification-token.repository.js';
import { PrismaLoginHistoryRepository } from './infrastructure/database/repositories/prisma-login-history.repository.js';
import { PrismaOrganizationRepository } from './infrastructure/database/repositories/prisma-organization.repository.js';
import { PrismaOrgInvitationRepository } from './infrastructure/database/repositories/prisma-org-invitation.repository.js';
import { RedisCacheProvider } from './infrastructure/cache/redis-cache.provider.js';
import { BcryptHasher } from './infrastructure/security/bcrypt-hasher.js';
import { JoseTokenManager } from './infrastructure/security/jose-token-manager.js';
import { GoogleOAuthProvider } from './infrastructure/social/google-oauth.provider.js';
import { SocialAuthProviderRegistry } from './infrastructure/social/social-auth-registry.js';
import { ConsoleEmailService } from './infrastructure/email/console-email.service.js';
import { AwsSesEmailService } from './infrastructure/email/aws-ses-email.service.js';
// Use Cases — Auth
import { AuthenticateUserUseCase } from './application/use-cases/auth/authenticate-user.use-case.js';
import { AuthenticateSocialUseCase } from './application/use-cases/auth/authenticate-social.use-case.js';
import { ValidateTokenUseCase } from './application/use-cases/auth/validate-token.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/refresh-token.use-case.js';
import { RevokeTokenUseCase } from './application/use-cases/auth/revoke-token.use-case.js';
import { VerifyEmailUseCase } from './application/use-cases/auth/verify-email.use-case.js';
import { ResendVerificationEmailUseCase } from './application/use-cases/auth/resend-verification-email.use-case.js';
import { RequestPasswordResetUseCase } from './application/use-cases/auth/request-password-reset.use-case.js';
import { ResetPasswordUseCase } from './application/use-cases/auth/reset-password.use-case.js';
import { ChangePasswordUseCase } from './application/use-cases/auth/change-password.use-case.js';
// Use Cases — User
import { RegisterUserUseCase } from './application/use-cases/user/register-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/user/get-user.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/user/update-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/user/delete-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/user/list-users.use-case.js';
// Use Cases — Client App
import { RegisterClientAppUseCase } from './application/use-cases/client-app/register-client-app.use-case.js';
import { ListClientAppsUseCase } from './application/use-cases/client-app/list-client-apps.use-case.js';
// Use Cases — Session
import { ListSessionsUseCase } from './application/use-cases/session/list-sessions.use-case.js';
import { RevokeSessionUseCase } from './application/use-cases/session/revoke-session.use-case.js';
import { GetLoginHistoryUseCase } from './application/use-cases/session/get-login-history.use-case.js';
// Use Cases — Social
import { LinkSocialAccountUseCase } from './application/use-cases/social/link-social-account.use-case.js';
import { UnlinkSocialAccountUseCase } from './application/use-cases/social/unlink-social-account.use-case.js';
// Use Cases — Organization
import { CreateOrganizationUseCase } from './application/use-cases/organization/create-organization.use-case.js';
import { ListUserOrganizationsUseCase } from './application/use-cases/organization/list-user-organizations.use-case.js';
import { GetOrganizationUseCase } from './application/use-cases/organization/get-organization.use-case.js';
import { UpdateOrganizationUseCase } from './application/use-cases/organization/update-organization.use-case.js';
import { InviteMemberUseCase } from './application/use-cases/organization/invite-member.use-case.js';
import { AcceptInvitationUseCase } from './application/use-cases/organization/accept-invitation.use-case.js';
import { RemoveMemberUseCase } from './application/use-cases/organization/remove-member.use-case.js';
import { ChangeMemberRoleUseCase } from './application/use-cases/organization/change-member-role.use-case.js';


// Controllers
import { AuthController } from './adapters/http/controllers/auth.controller.js';
import { UserController } from './adapters/http/controllers/user.controller.js';
import { ClientAppController } from './adapters/http/controllers/client-app.controller.js';
import { SessionController } from './adapters/http/controllers/session.controller.js';
import { OrganizationController } from './adapters/http/controllers/organization.controller.js';

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
  sessionController: SessionController;
  organizationController: OrganizationController;
  orgRepository: PrismaOrganizationRepository;

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

  // Email service (console for dev, SES for prod)
  const emailService = env.EMAIL_PROVIDER === 'ses'
    ? new AwsSesEmailService(env.EMAIL_FROM_ADDRESS, env.APP_URL, env.AWS_REGION)
    : new ConsoleEmailService();

  // ─── Repositories ───────────────────────────────────────────────────
  const userRepository = new PrismaUserRepository(prisma);
  const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
  const clientAppRepository = new PrismaClientAppRepository(prisma);
  const verificationTokenRepository = new PrismaVerificationTokenRepository(prisma);
  const loginHistoryRepository = new PrismaLoginHistoryRepository(prisma);
  const orgRepository = new PrismaOrganizationRepository(prisma);
  const orgInvitationRepository = new PrismaOrgInvitationRepository(prisma);

  // ─── Use Cases ──────────────────────────────────────────────────────
  const authenticateUserUC = new AuthenticateUserUseCase(
    userRepository, refreshTokenRepository, hasher, tokenManager,
    env.JWT_REFRESH_TOKEN_EXPIRY_DAYS,
    redis, env.LOGIN_MAX_ATTEMPTS, env.LOGIN_LOCKOUT_MINUTES,
    loginHistoryRepository,
  );
  const authenticateSocialUC = new AuthenticateSocialUseCase(
    userRepository, refreshTokenRepository, tokenManager, socialRegistry,
    env.JWT_REFRESH_TOKEN_EXPIRY_DAYS, loginHistoryRepository,
  );
  const validateTokenUC = new ValidateTokenUseCase(tokenManager, redis);
  const refreshTokenUC = new RefreshTokenUseCase(
    userRepository, refreshTokenRepository, tokenManager, env.JWT_REFRESH_TOKEN_EXPIRY_DAYS,
  );
  const revokeTokenUC = new RevokeTokenUseCase(refreshTokenRepository, tokenManager, redis);
  const registerUserUC = new RegisterUserUseCase(
    userRepository, hasher, verificationTokenRepository, emailService,
  );
  const verifyEmailUC = new VerifyEmailUseCase(userRepository, verificationTokenRepository);
  const resendVerificationEmailUC = new ResendVerificationEmailUseCase(
    userRepository, verificationTokenRepository, emailService,
  );
  const requestPasswordResetUC = new RequestPasswordResetUseCase(
    userRepository, verificationTokenRepository, emailService,
  );
  const resetPasswordUC = new ResetPasswordUseCase(
    userRepository, verificationTokenRepository, refreshTokenRepository, hasher,
  );
  const changePasswordUC = new ChangePasswordUseCase(userRepository, hasher);
  const getUserUC = new GetUserUseCase(userRepository);
  const updateUserUC = new UpdateUserUseCase(userRepository, hasher);
  const deleteUserUC = new DeleteUserUseCase(userRepository, refreshTokenRepository);
  const listUsersUC = new ListUsersUseCase(userRepository);
  const registerClientAppUC = new RegisterClientAppUseCase(clientAppRepository);
  const listClientAppsUC = new ListClientAppsUseCase(clientAppRepository);

  // Session use cases
  const listSessionsUC = new ListSessionsUseCase(refreshTokenRepository);
  const revokeSessionUC = new RevokeSessionUseCase(refreshTokenRepository);
  const getLoginHistoryUC = new GetLoginHistoryUseCase(loginHistoryRepository);

  // Social account management use cases
  const linkSocialAccountUC = new LinkSocialAccountUseCase(userRepository, socialRegistry);
  const unlinkSocialAccountUC = new UnlinkSocialAccountUseCase(userRepository);

  // Organization use cases
  const createOrganizationUC = new CreateOrganizationUseCase(orgRepository);
  const listUserOrganizationsUC = new ListUserOrganizationsUseCase(orgRepository);
  const getOrganizationUC = new GetOrganizationUseCase(orgRepository);
  const updateOrganizationUC = new UpdateOrganizationUseCase(orgRepository);
  const inviteMemberUC = new InviteMemberUseCase(orgRepository, orgInvitationRepository);
  const acceptInvitationUC = new AcceptInvitationUseCase(orgRepository, orgInvitationRepository);
  const removeMemberUC = new RemoveMemberUseCase(orgRepository);
  const changeMemberRoleUC = new ChangeMemberRoleUseCase(orgRepository);


  // ─── Middleware ─────────────────────────────────────────────────────
  const authMiddleware = createAuthMiddleware(tokenManager, redis);

  // ─── Controllers ────────────────────────────────────────────────────
  const authController = new AuthController(
    authenticateUserUC, authenticateSocialUC, validateTokenUC,
    refreshTokenUC, revokeTokenUC, registerUserUC, tokenManager,
    verifyEmailUC, resendVerificationEmailUC,
    requestPasswordResetUC, resetPasswordUC, changePasswordUC,
    env.APP_URL, env.VERIFICATION_TOKEN_EXPIRY_HOURS, env.PASSWORD_RESET_TOKEN_EXPIRY_HOURS,
  );
  const userController = new UserController(getUserUC, updateUserUC, deleteUserUC, listUsersUC);
  const clientAppController = new ClientAppController(registerClientAppUC, listClientAppsUC);
  const sessionController = new SessionController(
    listSessionsUC, revokeSessionUC, getLoginHistoryUC,
    linkSocialAccountUC, unlinkSocialAccountUC,
  );
  const organizationController = new OrganizationController(
    createOrganizationUC, listUserOrganizationsUC, getOrganizationUC,
    updateOrganizationUC, inviteMemberUC, acceptInvitationUC,
    removeMemberUC, changeMemberRoleUC, orgRepository,
  );

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
    sessionController,
    organizationController,
    orgRepository,
    authMiddleware,
    shutdown,
  };
}

