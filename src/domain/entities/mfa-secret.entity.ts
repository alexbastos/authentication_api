// ─── Enterprise Business Rules ────────────────────────────────────────────
// MFA Secret domain entity

import { MfaMethod } from './role.entity.js';

export interface MfaSecretProps {
  id: string;
  userId: string;
  secret: string;
  method: MfaMethod;
  verified: boolean;
  createdAt: Date;
}

export class MfaSecret {
  readonly id: string;
  readonly userId: string;
  private _secret: string;
  private _method: MfaMethod;
  private _verified: boolean;
  readonly createdAt: Date;

  constructor(props: MfaSecretProps) {
    this.id = props.id;
    this.userId = props.userId;
    this._secret = props.secret;
    this._method = props.method;
    this._verified = props.verified;
    this.createdAt = props.createdAt;
  }

  get secret(): string {
    return this._secret;
  }

  get method(): MfaMethod {
    return this._method;
  }

  get verified(): boolean {
    return this._verified;
  }

  markVerified(): void {
    this._verified = true;
  }

  toJSON(): MfaSecretProps {
    return {
      id: this.id,
      userId: this.userId,
      secret: this._secret,
      method: this._method,
      verified: this._verified,
      createdAt: this.createdAt,
    };
  }
}
