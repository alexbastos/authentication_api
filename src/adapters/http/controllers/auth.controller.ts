// ─── Auth Controller ──────────────────────────────────────────────────────
// Thin adapter layer: receives HTTP, calls use case, formats response

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticateUserUseCase } from '../../../application/use-cases/auth/authenticate-user.use-case.js';
import type { AuthenticateSocialUseCase } from '../../../application/use-cases/auth/authenticate-social.use-case.js';
import type { ValidateTokenUseCase } from '../../../application/use-cases/auth/validate-token.use-case.js';
import type { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh-token.use-case.js';
import type { RevokeTokenUseCase } from '../../../application/use-cases/auth/revoke-token.use-case.js';
import type { RegisterUserUseCase } from '../../../application/use-cases/user/register-user.use-case.js';
import type { VerifyEmailUseCase } from '../../../application/use-cases/auth/verify-email.use-case.js';
import type { ResendVerificationEmailUseCase } from '../../../application/use-cases/auth/resend-verification-email.use-case.js';
import type { RequestPasswordResetUseCase } from '../../../application/use-cases/auth/request-password-reset.use-case.js';
import type { ResetPasswordUseCase } from '../../../application/use-cases/auth/reset-password.use-case.js';
import type { ChangePasswordUseCase } from '../../../application/use-cases/auth/change-password.use-case.js';
import type { ITokenManager } from '../../../application/ports/token-manager.port.js';
import type {
  LoginBody, RegisterBody, SocialLoginBody, RefreshTokenBody,
  LogoutBody, ValidateTokenBody, VerifyEmailBody,
  ForgotPasswordBody, ResetPasswordBody, ChangePasswordBody,
} from '../schemas/auth.schema.js';
import { SocialProvider } from '../../../domain/entities/role.entity.js';

export class AuthController {
  constructor(
    private readonly authenticateUserUC: AuthenticateUserUseCase,
    private readonly authenticateSocialUC: AuthenticateSocialUseCase,
    private readonly validateTokenUC: ValidateTokenUseCase,
    private readonly refreshTokenUC: RefreshTokenUseCase,
    private readonly revokeTokenUC: RevokeTokenUseCase,
    private readonly registerUserUC: RegisterUserUseCase,
    private readonly tokenManager: ITokenManager,
    private readonly verifyEmailUC: VerifyEmailUseCase,
    private readonly resendVerificationEmailUC: ResendVerificationEmailUseCase,
    private readonly requestPasswordResetUC: RequestPasswordResetUseCase,
    private readonly resetPasswordUC: ResetPasswordUseCase,
    private readonly changePasswordUC: ChangePasswordUseCase,
    private readonly appUrl: string,
    private readonly verificationTokenExpiryHours: number,
    private readonly passwordResetTokenExpiryHours: number,
  ) {}

  async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    const result = await this.registerUserUC.execute({
      name: request.body.name,
      email: request.body.email,
      password: request.body.password,
      appUrl: this.appUrl,
      verificationTokenExpiryHours: this.verificationTokenExpiryHours,
    });

    return reply.status(201).send(result);
  }

  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const result = await this.authenticateUserUC.execute({
      email: request.body.email,
      password: request.body.password,
      identifier: request.ip,
    });

    return reply.status(200).send(result);
  }

  async socialLogin(request: FastifyRequest<{ Body: SocialLoginBody }>, reply: FastifyReply) {
    const result = await this.authenticateSocialUC.execute({
      provider: request.body.provider as SocialProvider,
      token: request.body.token,
    });

    return reply.status(200).send(result);
  }

  async refresh(request: FastifyRequest<{ Body: RefreshTokenBody }>, reply: FastifyReply) {
    const result = await this.refreshTokenUC.execute({
      refreshToken: request.body.refreshToken,
    });

    return reply.status(200).send(result);
  }

  async logout(request: FastifyRequest<{ Body: LogoutBody }>, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    await this.revokeTokenUC.execute({
      accessToken,
      refreshToken: request.body.refreshToken,
    });

    return reply.status(204).send();
  }

  async validate(request: FastifyRequest<{ Body: ValidateTokenBody }>, reply: FastifyReply) {
    const result = await this.validateTokenUC.execute({
      token: request.body.token,
    });

    return reply.status(200).send(result);
  }

  async jwks(_request: FastifyRequest, reply: FastifyReply) {
    const jwks = await this.tokenManager.getJWKS();
    return reply.status(200).send(jwks);
  }

  // ─── New Endpoints ────────────────────────────────────────────────────

  async verifyEmail(request: FastifyRequest<{ Body: VerifyEmailBody }>, reply: FastifyReply) {
    const result = await this.verifyEmailUC.execute({
      token: request.body.token,
    });

    return reply.status(200).send(result);
  }

  async resendVerification(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.resendVerificationEmailUC.execute({
      userId: request.user!.sub,
      appUrl: this.appUrl,
      expiryHours: this.verificationTokenExpiryHours,
    });

    return reply.status(200).send(result);
  }

  async forgotPassword(request: FastifyRequest<{ Body: ForgotPasswordBody }>, reply: FastifyReply) {
    const result = await this.requestPasswordResetUC.execute({
      email: request.body.email,
      appUrl: this.appUrl,
      expiryHours: this.passwordResetTokenExpiryHours,
    });

    return reply.status(200).send(result);
  }

  async resetPassword(request: FastifyRequest<{ Body: ResetPasswordBody }>, reply: FastifyReply) {
    const result = await this.resetPasswordUC.execute({
      token: request.body.token,
      newPassword: request.body.newPassword,
    });

    return reply.status(200).send(result);
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as ChangePasswordBody;
    const result = await this.changePasswordUC.execute({
      userId: request.user!.sub,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    return reply.status(200).send(result);
  }
}
