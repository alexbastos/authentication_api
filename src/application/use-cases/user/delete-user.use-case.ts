// ─── Use Case: Delete User (Soft Delete) ──────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IAccountSecurityRepository } from '../../ports/account-security.port.js';
import { Role } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  ForbiddenError,
} from '../../../domain/errors/domain-errors.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

export interface DeleteUserInput {
  userId: string;
  requesterId: string;
  requesterRole: Role;
}

export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly accountSecurityRepository: IAccountSecurityRepository,
    private readonly dispatchEventUC?: DispatchEventUseCase,
  ) {}

  async execute(input: DeleteUserInput): Promise<void> {
    // 1. Only admins or the user themselves can deactivate
    const isSelf = input.requesterId === input.userId;
    const isAdmin = input.requesterRole === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError('You can only deactivate your own account');
    }

    // 2. Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 3. Soft delete and revoke all sessions in the same database transaction.
    await this.accountSecurityRepository.deactivateUserAndRevokeSessions(input.userId);

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_DELETED,
        payload: {
          userId: input.userId,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
    }
  }
}
