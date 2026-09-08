// ─── JOSE Token Manager (RS256) ───────────────────────────────────────────

import * as jose from 'jose';
import { readFile } from 'fs/promises';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  ITokenManager,
  TokenPayload,
  MfaTokenPayload,
  IdTokenPayload,
  JWKSResponse,
} from '../../application/ports/token-manager.port.js';
import type { Role } from '../../domain/entities/role.entity.js';
import {
  MfaTokenExpiredError,
  MfaTokenInvalidError,
} from '../../domain/errors/domain-errors.js';

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
    private readonly defaultAudience: string = 'authentication-api',
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
    sid?: string;
    scopes?: string[];
    aud?: string;
  }): Promise<string> {
    await this.loadKeys();

    const jti = uuidv4();
    const jwt = new jose.SignJWT({
      email: payload.email,
      role: payload.role,
      tokenUse: 'access',
      ...(payload.permissions ? { permissions: payload.permissions } : {}),
      ...(payload.scopes ? { scopes: payload.scopes } : {}),
      ...(payload.sid ? { sid: payload.sid } : {}),
      jti,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'auth-key-1' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setExpirationTime(this.accessTokenExpiry);

    jwt.setAudience(payload.aud ?? this.defaultAudience);

    return jwt.sign(this.privateKey!);
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async generateMfaToken(payload: {
    sub: string;
    challengeId: string;
    expiresInSeconds: number;
  }): Promise<string> {
    await this.loadKeys();

    return new jose.SignJWT({
      tokenUse: 'mfa',
      challengeId: payload.challengeId,
      jti: uuidv4(),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'auth-key-1' })
      .setSubject(payload.sub)
      .setAudience('mfa-challenge')
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setExpirationTime(`${payload.expiresInSeconds}s`)
      .sign(this.privateKey!);
  }

  async generateIdToken(payload: IdTokenPayload): Promise<string> {
    await this.loadKeys();

    const claims: Record<string, unknown> = {
      email: payload.email,
      ...(payload.emailVerified !== undefined
        ? { email_verified: payload.emailVerified }
        : {}),
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

  async verifyAccessToken(token: string, options?: { allowAnyAudience?: boolean }): Promise<TokenPayload> {
    await this.loadKeys();

    const { payload } = await jose.jwtVerify(token, this.publicKey!, {
      issuer: this.issuer,
      algorithms: ['RS256'],
      ...(options?.allowAnyAudience ? {} : { audience: this.defaultAudience }),
    });

    if (
      payload.tokenUse !== 'access'
      || typeof payload.sub !== 'string'
      || typeof payload.email !== 'string'
      || (payload.role !== 'USER' && payload.role !== 'ADMIN')
      || typeof payload.jti !== 'string'
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
      || typeof payload.iss !== 'string'
      || (!Array.isArray(payload.aud) && typeof payload.aud !== 'string')
      || (payload.scopes !== undefined && (!Array.isArray(payload.scopes) || payload.scopes.some((scope) => typeof scope !== 'string')))
    ) {
      throw new Error('Invalid access token type');
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
      permissions: (payload.permissions as string[]) ?? undefined,
      sid: (payload.sid as string) ?? undefined,
      jti: payload.jti as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
      iss: payload.iss as string,
      aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
      scopes: payload.scopes as string[] | undefined,
      tokenUse: 'access',
    };
  }

  async verifyMfaToken(token: string): Promise<MfaTokenPayload> {
    await this.loadKeys();

    try {
      const { payload } = await jose.jwtVerify(token, this.publicKey!, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: 'mfa-challenge',
      });

      if (
        payload.tokenUse !== 'mfa' ||
        typeof payload.sub !== 'string' ||
        typeof payload.challengeId !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        typeof payload.iss !== 'string'
      ) {
        throw new MfaTokenInvalidError();
      }

      return {
        sub: payload.sub,
        challengeId: payload.challengeId,
        tokenUse: 'mfa',
        jti: payload.jti,
        iat: payload.iat,
        exp: payload.exp,
        iss: payload.iss,
        aud: 'mfa-challenge',
      };
    } catch (error) {
      if (error instanceof MfaTokenInvalidError) throw error;
      if (error instanceof jose.errors.JWTExpired) throw new MfaTokenExpiredError();
      throw new MfaTokenInvalidError();
    }
  }

  async getJWKS(): Promise<JWKSResponse> {
    await this.loadKeys();

    return {
      keys: [this.jwk!],
    };
  }
}
