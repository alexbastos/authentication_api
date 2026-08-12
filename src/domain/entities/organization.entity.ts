// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entities — Organization + Membership

import { OrgRole } from './role.entity.js';

export interface OrganizationProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization {
  readonly id: string;
  private _name: string;
  private _slug: string;
  private _description: string | null;
  private _logoUrl: string | null;
  private _isActive: boolean;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: OrganizationProps) {
    this.id = props.id;
    this._name = props.name;
    this._slug = props.slug;
    this._description = props.description;
    this._logoUrl = props.logoUrl;
    this._isActive = props.isActive;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string { return this._name; }
  get slug(): string { return this._slug; }
  get description(): string | null { return this._description; }
  get logoUrl(): string | null { return this._logoUrl; }
  get isActive(): boolean { return this._isActive; }
  get updatedAt(): Date { return this._updatedAt; }

  updateName(name: string): void { this._name = name; this.touch(); }
  updateDescription(description: string | null): void { this._description = description; this.touch(); }
  updateLogoUrl(logoUrl: string | null): void { this._logoUrl = logoUrl; this.touch(); }

  activate(): void { this._isActive = true; this.touch(); }
  deactivate(): void { this._isActive = false; this.touch(); }

  private touch(): void { this._updatedAt = new Date(); }

  toJSON(): OrganizationProps {
    return {
      id: this.id,
      name: this._name,
      slug: this._slug,
      description: this._description,
      logoUrl: this._logoUrl,
      isActive: this._isActive,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

// ─── Organization Member ──────────────────────────────────────────────────

export interface OrganizationMemberProps {
  id: string;
  userId: string;
  organizationId: string;
  role: OrgRole;
  joinedAt: Date;
  // Populated from join
  userName?: string;
  userEmail?: string;
}

export class OrganizationMember {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  private _role: OrgRole;
  readonly joinedAt: Date;
  readonly userName?: string;
  readonly userEmail?: string;

  constructor(props: OrganizationMemberProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.organizationId = props.organizationId;
    this._role = props.role;
    this.joinedAt = props.joinedAt;
    this.userName = props.userName;
    this.userEmail = props.userEmail;
  }

  get role(): OrgRole { return this._role; }

  get isOwner(): boolean { return this._role === OrgRole.OWNER; }

  changeRole(newRole: OrgRole): void {
    this._role = newRole;
  }

  toJSON(): OrganizationMemberProps {
    return {
      id: this.id,
      userId: this.userId,
      organizationId: this.organizationId,
      role: this._role,
      joinedAt: this.joinedAt,
      userName: this.userName,
      userEmail: this.userEmail,
    };
  }
}
