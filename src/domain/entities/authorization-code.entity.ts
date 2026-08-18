// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity for OAuth Authorization Codes

import crypto from 'node:crypto';
import { AuthorizationCodeExpiredError } from '../errors/domain-errors.js';

export interface AuthorizationCodeProps {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  nonce: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class AuthorizationCode {
  readonly id: string;
  readonly code: string;
  readonly clientId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: string | null;
  readonly nonce: string | null;
  readonly expiresAt: Date;
  private _usedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: AuthorizationCodeProps) {
    this.id = props.id;
    this.code = props.code;
    this.clientId = props.clientId;
    this.userId = props.userId;
    this.redirectUri = props.redirectUri;
    this.scope = props.scope;
    this.codeChallenge = props.codeChallenge;
    this.codeChallengeMethod = props.codeChallengeMethod;
    this.nonce = props.nonce;
    this.expiresAt = props.expiresAt;
    this._usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  get usedAt(): Date | null { return this._usedAt; }
  get isUsed(): boolean { return this._usedAt !== null; }
  get isExpired(): boolean { return this.expiresAt < new Date(); }

  validatePkce(codeVerifier: string): boolean {
    if (!this.codeChallenge || !this.codeChallengeMethod) return true; // PKCE not used

    if (this.codeChallengeMethod === 'S256') {
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'); // base64url is safe for PKCE S256
      return expectedChallenge === this.codeChallenge;
    }

    if (this.codeChallengeMethod === 'plain') {
      return codeVerifier === this.codeChallenge;
    }

    return false;
  }

  use(): void {
    if (this.isUsed) throw new Error('Authorization code already used');
    if (this.isExpired) throw new AuthorizationCodeExpiredError();
    this._usedAt = new Date();
  }

  toJSON(): AuthorizationCodeProps {
    return {
      id: this.id,
      code: this.code,
      clientId: this.clientId,
      userId: this.userId,
      redirectUri: this.redirectUri,
      scope: this.scope,
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: this.codeChallengeMethod,
      nonce: this.nonce,
      expiresAt: this.expiresAt,
      usedAt: this._usedAt,
      createdAt: this.createdAt,
    };
  }
}
