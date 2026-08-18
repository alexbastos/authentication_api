// ─── JOSE Token Manager (RS256) ───────────────────────────────────────────

import * as jose from 'jose';
import { readFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import type { ITokenManager, TokenPayload, IdTokenPayload, JWKSResponse } from '../../application/ports/token-manager.port.js';
import type { Role } from '../../domain/entities/role.entity.js';

type JoseKey = Awaited<ReturnType<typeof jose.importPKCS8>>;

export class JoseTokenManager implements ITokenManager {
  private privateKey: JoseKey | null = null;
  private publicKey: JoseKey | null = null;
  private jwk: jose.JWK | null = null;

  constructor(
    private readonly privateKeyPath: string,
    private readonly publicKeyPath: string,
    private readonly issuer: string,
    private readonly accessTokenExpiry: string = '15m',
  ) {}

  private async loadKeys(): Promise<void> {
    if (this.privateKey && this.publicKey) return;

    const [privateKeyPem, publicKeyPem] = await Promise.all([
      readFile(this.privateKeyPath, 'utf-8'),
      readFile(this.publicKeyPath, 'utf-8'),
    ]);

    this.privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
    this.publicKey = await jose.importSPKI(publicKeyPem, 'RS256');

    // Export public key as JWK for the JWKS endpoint
    this.jwk = await jose.exportJWK(this.publicKey);
    this.jwk.kid = 'auth-key-1';
    this.jwk.alg = 'RS256';
    this.jwk.use = 'sig';
  }

  async generateAccessToken(payload: {
    sub: string;
    email: string;
    role: Role;
    permissions?: string[];
    scopes?: string[];
    aud?: string;
  }): Promise<string> {
    await this.loadKeys();

    const jti = uuidv4();
    const jwt = new jose.SignJWT({
      email: payload.email,
      role: payload.role,
      ...(payload.permissions ? { permissions: payload.permissions } : {}),
      ...(payload.scopes ? { scopes: payload.scopes } : {}),
      jti,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'auth-key-1' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setExpirationTime(this.accessTokenExpiry);

    if (payload.aud) {
      jwt.setAudience(payload.aud);
    }

    return jwt.sign(this.privateKey!);
  }

  generateRefreshToken(): string {
    return uuidv4() + uuidv4().replace(/-/g, '');
  }

  async generateIdToken(payload: IdTokenPayload): Promise<string> {
    await this.loadKeys();

    const claims: Record<string, unknown> = {
      email: payload.email,
      name: payload.name,
      ...(payload.picture ? { picture: payload.picture } : {}),
      ...(payload.nonce ? { nonce: payload.nonce } : {}),
      ...(payload.auth_time ? { auth_time: payload.auth_time } : {}),
    };

    return new jose.SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'auth-key-1' })
      .setSubject(payload.sub)
      .setAudience(payload.aud)
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setExpirationTime('1h')
      .sign(this.privateKey!);
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    await this.loadKeys();

    const { payload } = await jose.jwtVerify(token, this.publicKey!, {
      issuer: this.issuer,
    });

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
      permissions: (payload.permissions as string[]) ?? undefined,
      jti: payload.jti as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
      iss: payload.iss as string,
      aud: payload.aud as string | undefined,
    };
  }

  async getJWKS(): Promise<JWKSResponse> {
    await this.loadKeys();

    return {
      keys: [this.jwk!],
    };
  }
}
