// ─── Use Case: Authenticate User (email/password) ────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ILoginHistoryRepository } from '../../../domain/repositories/login-history.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { LoginHistory } from '../../../domain/entities/login-history.entity.js';
import { LoginStatus, LoginMethod } from '../../../domain/entities/role.entity.js';
import {
  InvalidCredentialsError,
  UserInactiveError,
  EmailNotVerifiedError,
  AccountLockedError,
} from '../../../domain/errors/domain-errors.js';
import { parseDeviceName } from '../../../infrastructure/security/user-agent.util.js';
import { v4 as uuidv4 } from 'uuid';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

const BRUTE_FORCE_PREFIX = 'login_attempts:';

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

export interface AuthenticateUserOutput {
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
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const lockKey = `${BRUTE_FORCE_PREFIX}${input.identifier ?? input.email}`;
    const lockoutTtl = this.lockoutMinutes * 60;
    const deviceName = parseDeviceName(input.userAgent);

    // Check if account/IP is locked
    if (this.cacheProvider) {
      const attempts = await this.cacheProvider.get(lockKey);
      if (attempts && parseInt(attempts, 10) >= this.maxLoginAttempts) {
        throw new AccountLockedError(this.lockoutMinutes);
      }
    }

    const user = await this.userRepository.findByEmail(input.email);

    if (!user || !user.hasPassword) {
      await this.recordFailedAttempt(lockKey, lockoutTtl);
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

    if (!user.isActive) {
      await this.recordLoginHistory({
        userId: user.id,
        email: input.email,
        status: LoginStatus.FAILURE,
        method: LoginMethod.EMAIL_PASSWORD,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: 'User inactive',
      });
      throw new UserInactiveError();
    }

    const isPasswordValid = await this.hasher.compare(input.password, user.passwordHash!);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(lockKey, lockoutTtl);
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
      await this.cacheProvider.del(lockKey);
    }

    // Generate tokens
    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = this.tokenManager.generateRefreshToken();
    const family = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    const refreshToken = new RefreshToken({
      id: uuidv4(),
      token: refreshTokenValue,
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
    }).catch(console.error);

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
      }).catch(console.error); // Fire-and-forget logging handled inside if needed
    }

    return {
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

  private async recordFailedAttempt(lockKey: string, ttlSeconds: number): Promise<void> {
    if (this.cacheProvider) {
      await this.cacheProvider.increment(lockKey, ttlSeconds);
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

