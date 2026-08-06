// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity — no external dependencies

import { VerificationTokenType } from './role.entity.js';

export interface VerificationTokenProps {
  id: string;
  tokenHash: string;
  type: VerificationTokenType;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class VerificationToken {
  readonly id: string;
  readonly tokenHash: string;
  readonly type: VerificationTokenType;
  readonly userId: string;
  readonly expiresAt: Date;
  private _usedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: VerificationTokenProps) {
    this.id = props.id;
    this.tokenHash = props.tokenHash;
    this.type = props.type;
    this.userId = props.userId;
    this.expiresAt = props.expiresAt;
    this._usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isUsed(): boolean {
    return this._usedAt !== null;
  }

  get isValid(): boolean {
    return !this.isExpired && !this.isUsed;
  }

  markAsUsed(): void {
    this._usedAt = new Date();
  }

  toJSON(): VerificationTokenProps {
    return {
      id: this.id,
      tokenHash: this.tokenHash,
      type: this.type,
      userId: this.userId,
      expiresAt: this.expiresAt,
      usedAt: this._usedAt,
      createdAt: this.createdAt,
    };
  }
}
