// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity for OAuth User Consent

export interface OAuthConsentProps {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  grantedAt: Date;
}

export class OAuthConsent {
  readonly id: string;
  readonly userId: string;
  readonly clientId: string;
  private _scopes: string[];
  private _grantedAt: Date;

  constructor(props: OAuthConsentProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.clientId = props.clientId;
    this._scopes = props.scopes;
    this._grantedAt = props.grantedAt;
  }

  get scopes(): ReadonlyArray<string> { return this._scopes; }
  get grantedAt(): Date { return this._grantedAt; }

  hasScopes(requestedScopes: string[]): boolean {
    return requestedScopes.every((scope) => this._scopes.includes(scope));
  }

  updateScopes(newScopes: string[]): void {
    const combined = new Set([...this._scopes, ...newScopes]);
    this._scopes = Array.from(combined);
    this._grantedAt = new Date();
  }

  toJSON(): OAuthConsentProps {
    return {
      id: this.id,
      userId: this.userId,
      clientId: this.clientId,
      scopes: [...this._scopes],
      grantedAt: this._grantedAt,
    };
  }
}
