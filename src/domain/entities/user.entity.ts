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

/**
 * Value Object representing a user's physical address
 */
export interface UserAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
}

/**
 * Value Object representing extended profile fields
 */
export interface UserProfile {
  avatarUrl: string | null;
  phone: string | null;
  birthDate: Date | null;
  bio: string | null;
  locale: string | null;
  timezone: string | null;
  address: UserAddress;
}

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  role: Role;
  status: UserStatus;
  socialAccounts: ProviderInfo[];
  createdAt: Date;
  updatedAt: Date;
  // Profile
  avatarUrl?: string | null;
  phone?: string | null;
  birthDate?: Date | null;
  bio?: string | null;
  locale?: string | null;
  timezone?: string | null;
  address?: UserAddress;
}

export class User {
  readonly id: string;
  private _name: string;
  private _email: string;
  private _passwordHash: string | null;
  private _emailVerified: boolean;
  private _role: Role;
  private _status: UserStatus;
  private _socialAccounts: ProviderInfo[];
  readonly createdAt: Date;
  private _updatedAt: Date;
  // Profile
  private _avatarUrl: string | null;
  private _phone: string | null;
  private _birthDate: Date | null;
  private _bio: string | null;
  private _locale: string | null;
  private _timezone: string | null;
  private _address: UserAddress;

  constructor(props: UserProps) {
    this.id = props.id;
    this._name = props.name;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._emailVerified = props.emailVerified;
    this._role = props.role;
    this._status = props.status;
    this._socialAccounts = props.socialAccounts;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    // Profile
    this._avatarUrl = props.avatarUrl ?? null;
    this._phone = props.phone ?? null;
    this._birthDate = props.birthDate ?? null;
    this._bio = props.bio ?? null;
    this._locale = props.locale ?? null;
    this._timezone = props.timezone ?? null;
    this._address = props.address ?? { street: null, city: null, state: null, zipCode: null, country: null };
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

  get emailVerified(): boolean {
    return this._emailVerified;
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

  get profile(): UserProfile {
    return {
      avatarUrl: this._avatarUrl,
      phone: this._phone,
      birthDate: this._birthDate,
      bio: this._bio,
      locale: this._locale,
      timezone: this._timezone,
      address: { ...this._address },
    };
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

  verifyEmail(): void {
    this._emailVerified = true;
    this.touch();
  }

  updateRole(role: Role): void {
    this._role = role;
    this.touch();
  }

  updateProfile(profile: Partial<UserProfile>): void {
    if (profile.avatarUrl !== undefined) this._avatarUrl = profile.avatarUrl;
    if (profile.phone !== undefined) this._phone = profile.phone;
    if (profile.birthDate !== undefined) this._birthDate = profile.birthDate;
    if (profile.bio !== undefined) this._bio = profile.bio;
    if (profile.locale !== undefined) this._locale = profile.locale;
    if (profile.timezone !== undefined) this._timezone = profile.timezone;
    if (profile.address) {
      this._address = {
        street: profile.address.street ?? this._address.street,
        city: profile.address.city ?? this._address.city,
        state: profile.address.state ?? this._address.state,
        zipCode: profile.address.zipCode ?? this._address.zipCode,
        country: profile.address.country ?? this._address.country,
      };
    }
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

  /**
   * Removes a social provider link from the user.
   * Returns true if removed, false if the provider was not linked.
   * @throws Error if removing would leave the user with no authentication method.
   */
  removeSocialProvider(provider: SocialProvider): boolean {
    if (!this.hasSocialProvider(provider)) {
      return false;
    }

    // Check if user would be left with no auth method
    const otherSocialCount = this._socialAccounts.filter((sa) => sa.provider !== provider).length;
    const hasOtherAuthMethod = this._passwordHash !== null || otherSocialCount > 0;

    if (!hasOtherAuthMethod) {
      throw new Error('Cannot remove the last authentication method');
    }

    this._socialAccounts = this._socialAccounts.filter((sa) => sa.provider !== provider);
    this.touch();
    return true;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  toJSON(): UserProps & { address: UserAddress } {
    return {
      id: this.id,
      name: this._name,
      email: this._email,
      passwordHash: this._passwordHash,
      emailVerified: this._emailVerified,
      role: this._role,
      status: this._status,
      socialAccounts: [...this._socialAccounts],
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      avatarUrl: this._avatarUrl,
      phone: this._phone,
      birthDate: this._birthDate,
      bio: this._bio,
      locale: this._locale,
      timezone: this._timezone,
      address: { ...this._address },
    };
  }
}

