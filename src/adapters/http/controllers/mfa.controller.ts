// ─── MFA Controller ───────────────────────────────────────────────────────
// Thin adapter layer: receives HTTP, calls use case, formats response

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SetupMfaUseCase } from '../../../application/use-cases/mfa/setup-mfa.use-case.js';
import type { VerifyMfaSetupUseCase } from '../../../application/use-cases/mfa/verify-mfa-setup.use-case.js';
import type { ValidateMfaCodeUseCase, MfaValidationMethod } from '../../../application/use-cases/mfa/validate-mfa-code.use-case.js';
import type { DisableMfaUseCase } from '../../../application/use-cases/mfa/disable-mfa.use-case.js';
import type { GetMfaStatusUseCase } from '../../../application/use-cases/mfa/get-mfa-status.use-case.js';
import type { RegenerateRecoveryCodesUseCase } from '../../../application/use-cases/mfa/regenerate-recovery-codes.use-case.js';
import type { SendMfaEmailCodeUseCase } from '../../../application/use-cases/mfa/send-mfa-email-code.use-case.js';
import type { ITokenManager } from '../../../application/ports/token-manager.port.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ILoginHistoryRepository } from '../../../domain/repositories/login-history.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { DispatchEventUseCase } from '../../../application/use-cases/webhook/dispatch-event.use-case.js';
import type { IGeoIpService } from '../../../infrastructure/geo/geoip.service.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { Session } from '../../../domain/entities/session.entity.js';
import { LoginHistory } from '../../../domain/entities/login-history.entity.js';
import { LoginStatus, LoginMethod, MfaMethod } from '../../../domain/entities/role.entity.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import { parseDeviceName } from '../../../infrastructure/security/user-agent.util.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  SetupMfaBody,
  VerifyMfaSetupBody,
  ValidateMfaCodeBody,
  DisableMfaBody,
  RegenerateRecoveryCodesBody,
} from '../schemas/mfa.schema.js';

export class MfaController {
  constructor(
    private readonly setupMfaUC: SetupMfaUseCase,
    private readonly verifyMfaSetupUC: VerifyMfaSetupUseCase,
    private readonly validateMfaCodeUC: ValidateMfaCodeUseCase,
    private readonly disableMfaUC: DisableMfaUseCase,
    private readonly getMfaStatusUC: GetMfaStatusUseCase,
    private readonly regenerateRecoveryCodesUC: RegenerateRecoveryCodesUseCase,
    private readonly sendMfaEmailCodeUC: SendMfaEmailCodeUseCase,
    private readonly tokenManager: ITokenManager,
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly refreshTokenExpiryDays: number,
    private readonly loginHistoryRepository?: ILoginHistoryRepository,
    private readonly dispatchEventUC?: DispatchEventUseCase,
    private readonly sessionRepository?: ISessionRepository,
    private readonly geoIpService?: IGeoIpService,
  ) {}

  async setupMfa(request: FastifyRequest<{ Body: SetupMfaBody }>, reply: FastifyReply) {
    const result = await this.setupMfaUC.execute({
      userId: request.user!.sub,
      method: request.body.method as MfaMethod,
    });

    return reply.status(200).send(result);
  }

  async verifySetup(request: FastifyRequest<{ Body: VerifyMfaSetupBody }>, reply: FastifyReply) {
    const result = await this.verifyMfaSetupUC.execute({
      userId: request.user!.sub,
      code: request.body.code,
    });

    return reply.status(200).send(result);
  }

  async verifyCode(request: FastifyRequest<{ Body: ValidateMfaCodeBody }>, reply: FastifyReply) {
    // Verify the temporary MFA token
    const payload = await this.tokenManager.verifyAccessToken(request.body.mfaToken);
    const userId = payload.sub;
    const method: MfaValidationMethod = (request.body.method as MfaValidationMethod) ?? 'TOTP';

    // Validate the MFA code
    await this.validateMfaCodeUC.execute({
      userId,
      code: request.body.code,
      method,
    });

    // MFA verified — issue final tokens
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const family = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    const deviceName = parseDeviceName(request.headers['user-agent']);
    const ipAddress = request.ip ?? null;

    // Resolve geolocation from IP
    const location = this.geoIpService?.lookup(ipAddress ?? '') ?? null;

    // Create logical session
    let sessionId: string | undefined;
    if (this.sessionRepository) {
      const session = new Session({
        id: uuidv4(),
        userId: user.id,
        family,
        deviceName,
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress,
        location,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt,
        revokedAt: null,
      });
      await this.sessionRepository.create(session);
      sessionId = session.id;
    }

    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    });

    const refreshTokenValue = this.tokenManager.generateRefreshToken();

    const refreshToken = new RefreshToken({
      id: uuidv4(),
      token: refreshTokenValue,
      userId: user.id,
      family,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress,
      deviceName,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });

    await this.refreshTokenRepository.create(refreshToken);

    // Record successful login with MFA
    if (this.loginHistoryRepository) {
      const entry = new LoginHistory({
        id: uuidv4(),
        userId: user.id,
        email: user.email,
        status: LoginStatus.SUCCESS,
        method: LoginMethod.EMAIL_PASSWORD,
        ipAddress,
        userAgent: request.headers['user-agent'] ?? null,
        deviceName,
        failReason: null,
        createdAt: new Date(),
      });
      await this.loginHistoryRepository.create(entry).catch(console.error);
    }

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_LOGIN,
        payload: {
          userId: user.id,
          email: user.email,
          mfaVerified: true,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
      }).catch(console.error);
    }

    return reply.status(200).send({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  }

  async disable(request: FastifyRequest<{ Body: DisableMfaBody }>, reply: FastifyReply) {
    const result = await this.disableMfaUC.execute({
      userId: request.user!.sub,
      code: request.body.code,
    });

    return reply.status(200).send(result);
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.getMfaStatusUC.execute({
      userId: request.user!.sub,
    });

    return reply.status(200).send(result);
  }

  async regenerateRecoveryCodes(
    request: FastifyRequest<{ Body: RegenerateRecoveryCodesBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.regenerateRecoveryCodesUC.execute({
      userId: request.user!.sub,
      code: request.body.code,
    });

    return reply.status(200).send(result);
  }

  async sendEmailCode(request: FastifyRequest<{ Body: { mfaToken: string } }>, reply: FastifyReply) {
    const payload = await this.tokenManager.verifyAccessToken(request.body.mfaToken);

    const result = await this.sendMfaEmailCodeUC.execute({
      userId: payload.sub,
    });

    return reply.status(200).send(result);
  }
}
