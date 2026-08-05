// ─── JOSE Token Manager (RS256) ───────────────────────────────────────────

import * as jose from 'jose';
import { readFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import type { ITokenManager, TokenPayload, JWKSResponse } from '../../application/ports/token-manager.port.js';
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

  async generateAccessToken(payload: { sub: string; email: string; role: Role }): Promise<string> {
    await this.loadKeys();

    const jti = uuidv4();

    const token = await new jose.SignJWT({
      email: payload.email,
      role: payload.role,
      jti,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'auth-key-1' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setExpirationTime(this.accessTokenExpiry)
      .sign(this.privateKey!);

    return token;
  }

  generateRefreshToken(): string {
    return uuidv4() + uuidv4().replace(/-/g, '');
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
      jti: payload.jti as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
      iss: payload.iss as string,
    };
  }

  async getJWKS(): Promise<JWKSResponse> {
    await this.loadKeys();

    return {
      keys: [this.jwk!],
    };
  }
}
