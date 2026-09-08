// ─── Use Case: Accept Invitation ──────────────────────────────────────────

import { createHash } from 'node:crypto';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import type { IOrgInvitationRepository } from '../../../domain/repositories/org-invitation.repository.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import {
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
  InvitationEmailMismatchError,
  UserNotFoundError,
} from '../../../domain/errors/domain-errors.js';

export interface AcceptInvitationInput {
  token: string;
  userId: string;
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly orgRepository: IOrganizationRepository,
    private readonly invitationRepository: IOrgInvitationRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: AcceptInvitationInput) {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    if (invitation.isAccepted) {
      throw new InvitationAlreadyAcceptedError();
    }

    if (invitation.isExpired) {
      throw new InvitationExpiredError();
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);
    if (user.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()) {
      throw new InvitationEmailMismatchError();
    }

    const accepted = await this.invitationRepository.acceptAndAddMember({
      invitationId: invitation.id,
      organizationId: invitation.organizationId,
      userId: input.userId,
      role: invitation.role,
    });
    if (!accepted) throw new InvitationAlreadyAcceptedError();

    const member = await this.orgRepository.findMember(invitation.organizationId, input.userId);
    if (!member) throw new InvitationNotFoundError();

    return {
      organizationId: invitation.organizationId,
      organizationName: invitation.organizationName,
      role: invitation.role,
      member: member.toJSON(),
    };
  }
}
