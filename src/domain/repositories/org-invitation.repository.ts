// ─── Domain Repository Contract — OrgInvitation ──────────────────────────

import type { OrgInvitation } from '../entities/org-invitation.entity.js';
import type { OrgRole } from '../entities/role.entity.js';

export interface IOrgInvitationRepository {
  create(invitation: OrgInvitation): Promise<OrgInvitation>;
  findByTokenHash(tokenHash: string): Promise<OrgInvitation | null>;
  findPendingByEmail(email: string): Promise<OrgInvitation[]>;
  findByOrganizationId(organizationId: string): Promise<OrgInvitation[]>;
  acceptAndAddMember(input: {
    invitationId: string;
    organizationId: string;
    userId: string;
    role: OrgRole;
  }): Promise<boolean>;
}
