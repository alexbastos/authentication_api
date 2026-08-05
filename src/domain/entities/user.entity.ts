// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity — no external dependencies

import { Role, UserStatus, SocialProvider } from './role.entity.js';

/**
 * Value Object representing a social login provider link
 */
export interface ProviderInfo {
  provider: SocialProvider;
  providerAccountId: string;
}

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: Role;
  status: UserStatus;
  socialAccounts: ProviderInfo[];
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  private _name: string;
  private _email: string;
  private _passwordHash: string | null;
  private _role: Role;
  private _status: UserStatus;
  private _socialAccounts: ProviderInfo[];
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this._name = props.name;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._role = props.role;
    this._status = props.status;
    this._socialAccounts = props.socialAccounts;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // ─── Getters ──────────────────────────────────────────────────────────

  get name(): string {
    return this._name;
  }

  get email(): string {
    return this._email;
  }

  get passwordHash(): string | null {
    return this._passwordHash;
  }

  get role(): Role {
    return this._role;
  }

  get status(): UserStatus {
    return this._status;
  }

  get socialAccounts(): ReadonlyArray<ProviderInfo> {
    return this._socialAccounts;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ─── Domain Methods ───────────────────────────────────────────────────

  get isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }

  get hasPassword(): boolean {
    return this._passwordHash !== null;
  }

  activate(): void {
    this._status = UserStatus.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    this._status = UserStatus.INACTIVE;
    this.touch();
  }

  updateName(name: string): void {
    this._name = name;
    this.touch();
  }

  updateEmail(email: string): void {
    this._email = email;
    this.touch();
  }

  updatePassword(hashedPassword: string): void {
    this._passwordHash = hashedPassword;
    this.touch();
  }

  updateRole(role: Role): void {
    this._role = role;
    this.touch();
  }

  hasSocialProvider(provider: SocialProvider): boolean {
    return this._socialAccounts.some((sa) => sa.provider === provider);
  }

  addSocialProvider(providerInfo: ProviderInfo): void {
    if (this.hasSocialProvider(providerInfo.provider)) {
      return; // Already linked
    }
    this._socialAccounts.push(providerInfo);
    this.touch();
  }

  getSocialProviderAccountId(provider: SocialProvider): string | null {
    const account = this._socialAccounts.find((sa) => sa.provider === provider);
    return account?.providerAccountId ?? null;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  toJSON(): UserProps {
    return {
      id: this.id,
      name: this._name,
      email: this._email,
      passwordHash: this._passwordHash,
      role: this._role,
      status: this._status,
      socialAccounts: [...this._socialAccounts],
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
