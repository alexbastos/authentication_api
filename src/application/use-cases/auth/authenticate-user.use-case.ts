import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ILoginHistoryRepository } from '../../../domain/repositories/login-history.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import type { IGeoIpService } from '../../ports/geo-ip.port.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { Session } from '../../../domain/entities/session.entity.js';
import { LoginHistory } from '../../../domain/entities/login-history.entity.js';
import { LoginStatus, LoginMethod } from '../../../domain/entities/role.entity.js';
import {
  InvalidCredentialsError,
  UserInactiveError,
  EmailNotVerifiedError,
  AccountLockedError,
} from '../../../domain/errors/domain-errors.js';
import { parseDeviceName } from '../../services/device-name.service.js';
import { v4 as uuidv4 } from 'uuid';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';
import type {
  MfaChallengeMethod,
  MfaChallengeService,
} from '../../services/mfa-challenge.service.js';

const BRUTE_FORCE_PREFIX = 'login_attempts:';
const LEGACY_DUMMY_PASSWORD_HASH = '$2b$12$XaBA0DfgSm2MNwOaX3dGWOsj2W83MskeGc5E.ZuS17v72geFW9uoy';

export interface AuthenticateUserInput {
  email: string;
  password: string;
  /** IP or identifier for brute force tracking */
  identifier?: string;
  /** Raw User-Agent header */
  userAgent?: string;
  /** Client IP address */
  ipAddress?: string;
}

export interface AuthenticatedLoginOutput {
  type: 'authenticated';
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export interface MfaRequiredLoginOutput {
  type: 'mfa_required';
  mfaToken: string;
  availableMethods: MfaChallengeMethod[];
}

export type AuthenticateUserOutput = AuthenticatedLoginOutput | MfaRequiredLoginOutput;

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly hasher: IHasher,
    private readonly tokenManager: ITokenManager,
    private readonly refreshTokenExpiryDays: number = 7,
    private readonly cacheProvider?: ICacheProvider,
    private readonly maxLoginAttempts: number = 5,
    private readonly lockoutMinutes: number = 15,
    private readonly loginHistoryRepository?: ILoginHistoryRepository,
    private readonly dispatchEventUC?: DispatchEventUseCase,
    private readonly sessionRepository?: ISessionRepository,
    private readonly geoIpService?: IGeoIpService,
    private readonly mfaRepository?: IMfaRepository,
    private readonly mfaChallengeService?: MfaChallengeService,
    private readonly secureTokenService?: ISecureTokenService,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const emailIdentifier = this.secureTokenService?.digest(normalizedEmail) ?? normalizedEmail;
    const lockKeys = [
      `${BRUTE_FORCE_PREFIX}account:${emailIdentifier}`,
      `${BRUTE_FORCE_PREFIX}network:${input.identifier ?? input.ipAddress ?? 'unknown'}`,
    ];
    const lockoutTtl = this.lockoutMinutes * 60;
    const deviceName = parseDeviceName(input.userAgent);

    // Check if account/IP is locked
    if (this.cacheProvider) {
      const attempts = await Promise.all(lockKeys.map((key) => this.cacheProvider!.get(key)));
      if (attempts.some((value) => value && parseInt(value, 10) >= this.maxLoginAttempts)) {
        throw new AccountLockedError(this.lockoutMinutes);
      }
    }

    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || !user.hasPassword) {
      if (this.hasher.dummyCompare) await this.hasher.dummyCompare(input.password);
      else await this.hasher.compare(input.password, LEGACY_DUMMY_PASSWORD_HASH);
      await this.recordFailedAttempt(lockKeys, lockoutTtl);
      await this.recordLoginHistory({
        userId: user?.id ?? null,
        email: input.email,
        status: LoginStatus.FAILURE,
        method: LoginMethod.EMAIL_PASSWORD,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: 'Invalid credentials',
      });
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.hasher.compare(input.password, user.passwordHash!);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(lockKeys, lockoutTtl);
      await this.recordLoginHistory({
        userId: user.id,
        email: input.email,
        status: LoginStatus.FAILURE,
        method: LoginMethod.EMAIL_PASSWORD,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: 'Invalid password',
      });
      throw new InvalidCredentialsError();
    }

    if (this.hasher.needsRehash?.(user.passwordHash!)) {
      user.updatePassword(await this.hasher.hash(input.password));
      await this.userRepository.update(user);
    }

    if (!user.isActive) {
      await this.recordLoginHistory({
        userId: user.id,
        email: normalizedEmail,
        status: LoginStatus.FAILURE,
        method: LoginMethod.EMAIL_PASSWORD,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: 'User inactive',
      });
      throw new UserInactiveError();
    }

    // Require email verification before granting access
    if (!user.emailVerified) {
      await this.recordLoginHistory({
        userId: user.id,
        email: input.email,
        status: LoginStatus.FAILURE,
        method: LoginMethod.EMAIL_PASSWORD,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: 'Email not verified',
      });
      throw new EmailNotVerifiedError();
    }

    // Success: clear failed attempts counter
    if (this.cacheProvider) {
      await Promise.all(lockKeys.map((key) => this.cacheProvider!.del(key)));
    }

    // ─── MFA Check ────────────────────────────────────────────────────
    if (user.mfaEnabled) {
      if (!this.mfaRepository || !this.mfaChallengeService || !user.mfaMethod) {
        throw new Error('MFA challenge services are not configured');
      }

      const availableMethods: MfaChallengeMethod[] = user.mfaMethod === 'TOTP'
        ? ['TOTP', 'EMAIL']
        : ['EMAIL'];
      const recoveryCodesRemaining = await this.mfaRepository.countUnusedRecoveryCodes(user.id);
      if (recoveryCodesRemaining > 0) availableMethods.push('RECOVERY');

      const mfaToken = await this.mfaChallengeService.create(user.id, availableMethods);

      return {
        type: 'mfa_required',
        mfaToken,
        availableMethods,
      };
    }

    // ─── Create Session & Tokens ──────────────────────────────────────
    const family = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    // Resolve geolocation from IP
    const location = this.geoIpService?.lookup(input.ipAddress ?? '') ?? null;

    // Create logical session
    let sessionId: string | undefined;
    if (this.sessionRepository) {
      const session = new Session({
        id: uuidv4(),
        userId: user.id,
        family,
        deviceName,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        location,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt,
        revokedAt: null,
      });
      await this.sessionRepository.create(session);
      sessionId = session.id;
    }

    // Generate tokens with session ID
    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    });

    const refreshTokenValue = this.tokenManager.generateRefreshToken();

    const refreshToken = new RefreshToken({
      id: uuidv4(),
      token: this.secureTokenService?.digest(refreshTokenValue) ?? refreshTokenValue,
      userId: user.id,
      family,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      deviceName,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });

    await this.refreshTokenRepository.create(refreshToken);

    // Record successful login
    await this.recordLoginHistory({
      userId: user.id,
      email: user.email,
      status: LoginStatus.SUCCESS,
      method: LoginMethod.EMAIL_PASSWORD,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      deviceName,
      failReason: null,
    }).catch(() => undefined);

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_LOGIN,
        payload: {
          userId: user.id,
          email: user.email,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          deviceName,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
    }

    return {
      type: 'authenticated',
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  private async recordFailedAttempt(lockKeys: string[], ttlSeconds: number): Promise<void> {
    if (this.cacheProvider) {
      await Promise.all(lockKeys.map((key) => this.cacheProvider!.increment(key, ttlSeconds)));
    }
  }

  private async recordLoginHistory(data: {
    userId: string | null;
    email: string;
    status: LoginStatus;
    method: LoginMethod;
    ipAddress: string | null;
    userAgent: string | null;
    deviceName: string | null;
    failReason: string | null;
  }): Promise<void> {
    if (this.loginHistoryRepository) {
      const entry = new LoginHistory({
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
      });
      await this.loginHistoryRepository.create(entry);
    }
  }
}
