// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity — no external dependencies

export interface RefreshTokenProps {
  id: string;
  token: string;
  userId: string;
  family: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export class RefreshToken {
  readonly id: string;
  readonly token: string;
  readonly userId: string;
  readonly family: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  private _revokedAt: Date | null;

  constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.token = props.token;
    this.userId = props.userId;
    this.family = props.family;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
    this._revokedAt = props.revokedAt;
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

  get isValid(): boolean {
    return !this.isExpired && !this.isRevoked;
  }

  revoke(): void {
    if (!this._revokedAt) {
      this._revokedAt = new Date();
    }
  }
}
