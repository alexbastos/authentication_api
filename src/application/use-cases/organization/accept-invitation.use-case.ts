// ─── Use Case: Accept Invitation ──────────────────────────────────────────

import { createHash } from 'node:crypto';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import type { IOrgInvitationRepository } from '../../../domain/repositories/org-invitation.repository.js';
import {
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
} from '../../../domain/errors/domain-errors.js';

export interface AcceptInvitationInput {
  token: string;
  userId: string;
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly orgRepository: IOrganizationRepository,
    private readonly invitationRepository: IOrgInvitationRepository,
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

    // Create membership
    const member = await this.orgRepository.addMember(
      invitation.organizationId,
      input.userId,
      invitation.role,
    );

    // Mark invitation as accepted
    await this.invitationRepository.markAccepted(invitation.id);

    return {
      organizationId: invitation.organizationId,
      organizationName: invitation.organizationName,
      role: invitation.role,
      member: member.toJSON(),
    };
  }
}
