// ─── Auth Controller ──────────────────────────────────────────────────────
// Thin adapter layer: receives HTTP, calls use case, formats response

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticateUserUseCase } from '../../../application/use-cases/auth/authenticate-user.use-case.js';
import type { AuthenticateSocialUseCase } from '../../../application/use-cases/auth/authenticate-social.use-case.js';
import type { ValidateTokenUseCase } from '../../../application/use-cases/auth/validate-token.use-case.js';
import type { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh-token.use-case.js';
import type { RevokeTokenUseCase } from '../../../application/use-cases/auth/revoke-token.use-case.js';
import type { RegisterUserUseCase } from '../../../application/use-cases/user/register-user.use-case.js';
import type { ITokenManager } from '../../../application/ports/token-manager.port.js';
import type { LoginBody, RegisterBody, SocialLoginBody, RefreshTokenBody, LogoutBody, ValidateTokenBody } from '../schemas/auth.schema.js';
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
  ) {}

  async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    const result = await this.registerUserUC.execute({
      name: request.body.name,
      email: request.body.email,
      password: request.body.password,
    });

    return reply.status(201).send(result);
  }

  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const result = await this.authenticateUserUC.execute({
      email: request.body.email,
      password: request.body.password,
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
}
