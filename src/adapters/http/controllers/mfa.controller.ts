// ─── MFA Controller ───────────────────────────────────────────────────────
// Thin adapter layer: receives HTTP, calls use case, formats response

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SetupMfaUseCase } from '../../../application/use-cases/mfa/setup-mfa.use-case.js';
import type { VerifyMfaSetupUseCase } from '../../../application/use-cases/mfa/verify-mfa-setup.use-case.js';
import type { MfaValidationMethod } from '../../../application/use-cases/mfa/validate-mfa-code.use-case.js';
import type { DisableMfaUseCase } from '../../../application/use-cases/mfa/disable-mfa.use-case.js';
import type { GetMfaStatusUseCase } from '../../../application/use-cases/mfa/get-mfa-status.use-case.js';
import type { RegenerateRecoveryCodesUseCase } from '../../../application/use-cases/mfa/regenerate-recovery-codes.use-case.js';
import type { SendMfaEmailCodeUseCase } from '../../../application/use-cases/mfa/send-mfa-email-code.use-case.js';
import type { MfaChallengeService } from '../../../application/services/mfa-challenge.service.js';
import { MfaTokenInvalidError } from '../../../domain/errors/domain-errors.js';
import { MfaMethod } from '../../../domain/entities/role.entity.js';
import type { CompleteMfaLoginUseCase } from '../../../application/use-cases/mfa/complete-mfa-login.use-case.js';
import type {
  SetupMfaBody,
  VerifyMfaSetupBody,
  ValidateMfaCodeBody,
  DisableMfaBody,
  RegenerateRecoveryCodesBody,
  SendMfaEmailCodeBody,
} from '../schemas/mfa.schema.js';

export class MfaController {
  constructor(
    private readonly setupMfaUC: SetupMfaUseCase,
    private readonly verifyMfaSetupUC: VerifyMfaSetupUseCase,
    private readonly completeMfaLoginUC: CompleteMfaLoginUseCase,
    private readonly disableMfaUC: DisableMfaUseCase,
    private readonly getMfaStatusUC: GetMfaStatusUseCase,
    private readonly regenerateRecoveryCodesUC: RegenerateRecoveryCodesUseCase,
    private readonly sendMfaEmailCodeUC: SendMfaEmailCodeUseCase,
    private readonly mfaChallengeService: MfaChallengeService,
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
    const result = await this.completeMfaLoginUC.execute({
      mfaToken: request.body.mfaToken,
      code: request.body.code,
      method: request.body.method as MfaValidationMethod,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    return reply.status(200).send(result);
  }

  async disable(request: FastifyRequest<{ Body: DisableMfaBody }>, reply: FastifyReply) {
    const result = await this.disableMfaUC.execute({
      userId: request.user!.sub,
      code: request.body.code,
      method: request.body.method as MfaValidationMethod,
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
      method: request.body.method as MfaValidationMethod,
    });

    return reply.status(200).send(result);
  }

  async sendEmailCode(request: FastifyRequest<{ Body: SendMfaEmailCodeBody }>, reply: FastifyReply) {
    let userId: string;
    let accountAction = false;

    if (request.user?.sub) {
      userId = request.user.sub;
      accountAction = true;
    } else if (request.body.mfaToken) {
      const challenge = await this.mfaChallengeService.getActive(request.body.mfaToken);
      this.mfaChallengeService.assertMethodAllowed(challenge, 'EMAIL');
      userId = challenge.userId;
    } else {
      throw new MfaTokenInvalidError();
    }

    const result = await this.sendMfaEmailCodeUC.execute({
      userId,
      accountAction,
    });

    return reply.status(200).send(result);
  }
}
