// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity — no external dependencies

export interface GeoLocation {
  city: string | null;
  region: string | null;
  countryCode: string | null;
  countryName: string | null;
}

export interface SessionProps {
  id: string;
  userId: string;
  family: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  location: GeoLocation | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export class Session {
  readonly id: string;
  readonly userId: string;
  readonly family: string;
  readonly deviceName: string | null;
  readonly userAgent: string | null;
  private _ipAddress: string | null;
  private _location: GeoLocation | null;
  readonly createdAt: Date;
  private _lastSeenAt: Date;
  readonly expiresAt: Date;
  private _revokedAt: Date | null;

  constructor(props: SessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.family = props.family;
    this.deviceName = props.deviceName;
    this.userAgent = props.userAgent;
    this._ipAddress = props.ipAddress;
    this._location = props.location;
    this.createdAt = props.createdAt;
    this._lastSeenAt = props.lastSeenAt;
    this.expiresAt = props.expiresAt;
    this._revokedAt = props.revokedAt;
  }

  get ipAddress(): string | null {
    return this._ipAddress;
  }

  get location(): GeoLocation | null {
    return this._location;
  }

  get lastSeenAt(): Date {
    return this._lastSeenAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  get isActive(): boolean {
    return !this.isExpired && !this.isRevoked;
  }

  revoke(): void {
    if (!this._revokedAt) {
      this._revokedAt = new Date();
    }
  }

  updateActivity(ipAddress: string | null, location: GeoLocation | null): void {
    this._ipAddress = ipAddress;
    this._location = location;
    this._lastSeenAt = new Date();
  }
}
