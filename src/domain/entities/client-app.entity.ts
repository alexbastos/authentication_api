// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity — no external dependencies

export interface ClientAppProps {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUrls: string[];
  isActive: boolean;
  grantTypes: string[];
  scopes: string[];
  tokenEndpointAuth: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ClientApp {
  readonly id: string;
  private _name: string;
  private _clientId: string;
  private _clientSecret: string;
  private _redirectUrls: string[];
  private _isActive: boolean;
  private _grantTypes: string[];
  private _scopes: string[];
  private _tokenEndpointAuth: string;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ClientAppProps) {
    this.id = props.id;
    this._name = props.name;
    this._clientId = props.clientId;
    this._clientSecret = props.clientSecret;
    this._redirectUrls = props.redirectUrls;
    this._isActive = props.isActive;
    this._grantTypes = props.grantTypes;
    this._scopes = props.scopes;
    this._tokenEndpointAuth = props.tokenEndpointAuth;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string { return this._name; }
  get clientId(): string { return this._clientId; }
  get clientSecret(): string { return this._clientSecret; }
  get redirectUrls(): ReadonlyArray<string> { return this._redirectUrls; }
  get isActive(): boolean { return this._isActive; }
  get grantTypes(): ReadonlyArray<string> { return this._grantTypes; }
  get scopes(): ReadonlyArray<string> { return this._scopes; }
  get tokenEndpointAuth(): string { return this._tokenEndpointAuth; }
  get updatedAt(): Date { return this._updatedAt; }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  isValidRedirectUrl(url: string): boolean {
    return this._redirectUrls.includes(url);
  }

  toJSON(): ClientAppProps {
    return {
      id: this.id,
      name: this._name,
      clientId: this._clientId,
      clientSecret: this._clientSecret,
      redirectUrls: [...this._redirectUrls],
      isActive: this._isActive,
      grantTypes: [...this._grantTypes],
      scopes: [...this._scopes],
      tokenEndpointAuth: this._tokenEndpointAuth,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
