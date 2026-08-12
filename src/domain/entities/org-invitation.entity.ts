// ─── Enterprise Business Rules ────────────────────────────────────────────
// OrgInvitation domain entity

import { OrgRole } from './role.entity.js';

export interface OrgInvitationProps {
  id: string;
  email: string;
  organizationId: string;
  role: OrgRole;
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  // Populated from join
  organizationName?: string;
}

export class OrgInvitation {
  readonly id: string;
  readonly email: string;
  readonly organizationId: string;
  readonly role: OrgRole;
  readonly invitedBy: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  private _acceptedAt: Date | null;
  readonly createdAt: Date;
  readonly organizationName?: string;

  constructor(props: OrgInvitationProps) {
    this.id = props.id;
    this.email = props.email;
    this.organizationId = props.organizationId;
    this.role = props.role;
    this.invitedBy = props.invitedBy;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this._acceptedAt = props.acceptedAt;
    this.createdAt = props.createdAt;
    this.organizationName = props.organizationName;
  }

  get acceptedAt(): Date | null { return this._acceptedAt; }
  get isExpired(): boolean { return new Date() > this.expiresAt; }
  get isAccepted(): boolean { return this._acceptedAt !== null; }
  get isPending(): boolean { return !this.isAccepted && !this.isExpired; }

  accept(): void {
    this._acceptedAt = new Date();
  }

  toJSON(): OrgInvitationProps {
    return {
      id: this.id,
      email: this.email,
      organizationId: this.organizationId,
      role: this.role,
      invitedBy: this.invitedBy,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      acceptedAt: this._acceptedAt,
      createdAt: this.createdAt,
      organizationName: this.organizationName,
    };
  }
}
