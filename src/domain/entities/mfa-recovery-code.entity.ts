// ─── Enterprise Business Rules ────────────────────────────────────────────
// MFA Recovery Code domain entity

export interface MfaRecoveryCodeProps {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

export class MfaRecoveryCode {
  readonly id: string;
  readonly userId: string;
  readonly codeHash: string;
  private _usedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: MfaRecoveryCodeProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.codeHash = props.codeHash;
    this._usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  get isUsed(): boolean {
    return this._usedAt !== null;
  }

  markUsed(): void {
    this._usedAt = new Date();
  }

  toJSON(): MfaRecoveryCodeProps {
    return {
      id: this.id,
      userId: this.userId,
      codeHash: this.codeHash,
      usedAt: this._usedAt,
      createdAt: this.createdAt,
    };
  }
}
