// ─── Use Case: Authenticate with Social Provider ─────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ILoginHistoryRepository } from '../../../domain/repositories/login-history.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { ISocialAuthProviderRegistry } from '../../ports/social-auth.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { MfaChallengeMethod, MfaChallengeService } from '../../services/mfa-challenge.service.js';
import type { IGeoIpService } from '../../ports/geo-ip.port.js';
import { User } from '../../../domain/entities/user.entity.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { Session } from '../../../domain/entities/session.entity.js';
import { LoginHistory } from '../../../domain/entities/login-history.entity.js';
import { Role, UserStatus, SocialProvider, LoginStatus, LoginMethod } from '../../../domain/entities/role.entity.js';
import { SocialAuthError, UserInactiveError } from '../../../domain/errors/domain-errors.js';
import { parseDeviceName } from '../../services/device-name.service.js';
import { v4 as uuidv4 } from 'uuid';

const SOCIAL_LOGIN_METHOD_MAP: Record<SocialProvider, LoginMethod> = {
  [SocialProvider.GOOGLE]: LoginMethod.SOCIAL_GOOGLE,
  [SocialProvider.APPLE]: LoginMethod.SOCIAL_APPLE,
  [SocialProvider.FACEBOOK]: LoginMethod.SOCIAL_FACEBOOK,
  [SocialProvider.GITHUB]: LoginMethod.SOCIAL_GITHUB,
};

export interface AuthenticateSocialInput {
  provider: SocialProvider;
  token: string; // ID token or access token from the social provider
  /** Raw User-Agent header */
  userAgent?: string;
  /** Client IP address */
  ipAddress?: string;
}

export interface AuthenticatedSocialOutput {
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
  isNewUser: boolean;
}

export interface MfaRequiredSocialOutput {
  type: 'mfa_required';
  mfaToken: string;
  availableMethods: MfaChallengeMethod[];
}

export type AuthenticateSocialOutput = AuthenticatedSocialOutput | MfaRequiredSocialOutput;

export class AuthenticateSocialUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenManager: ITokenManager,
    private readonly socialProviderRegistry: ISocialAuthProviderRegistry,
    private readonly refreshTokenExpiryDays: number = 7,
    private readonly loginHistoryRepository?: ILoginHistoryRepository,
    private readonly sessionRepository?: ISessionRepository,
    private readonly geoIpService?: IGeoIpService,
    private readonly secureTokenService?: ISecureTokenService,
    private readonly mfaRepository?: IMfaRepository,
    private readonly mfaChallengeService?: MfaChallengeService,
  ) {}

  async execute(input: AuthenticateSocialInput): Promise<AuthenticateSocialOutput> {
    const loginMethod = SOCIAL_LOGIN_METHOD_MAP[input.provider];
    const deviceName = parseDeviceName(input.userAgent);

    // 1. Get the provider implementation
    const socialProvider = this.socialProviderRegistry.getProvider(input.provider);
    if (!socialProvider) {
      await this.recordLoginHistory({
        userId: null,
        email: '',
        status: LoginStatus.FAILURE,
        method: loginMethod,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: 'Provider not supported',
      });
      throw new SocialAuthError(input.provider, 'Provider not supported');
    }

    // 2. Validate token and get user info from the social provider
    let socialUserInfo;
    try {
      socialUserInfo = await socialProvider.getUserInfo(input.token);
    } catch (error) {
      await this.recordLoginHistory({
        userId: null,
        email: '',
        status: LoginStatus.FAILURE,
        method: loginMethod,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        deviceName,
        failReason: error instanceof Error ? error.message : 'Failed to validate social token',
      });
      throw new SocialAuthError(
        input.provider,
        error instanceof Error ? error.message : 'Failed to validate social token',
      );
    }

    // 3. Check if user exists by provider+providerAccountId first
    let user = await this.userRepository.findByProvider(
      input.provider,
      socialUserInfo.providerAccountId,
    );

    let isNewUser = false;

    if (!user) {
      // 4. Check if user exists by email
      user = await this.userRepository.findByEmail(socialUserInfo.email);

      if (user) {
        // 5a. User exists but without this social link — add the link
        await this.userRepository.addSocialAccount(user.id, {
          provider: input.provider,
          providerAccountId: socialUserInfo.providerAccountId,
        });
      } else {
        // 5b. User doesn't exist — auto-register
        isNewUser = true;
        const now = new Date();
        user = new User({
          id: uuidv4(),
          name: socialUserInfo.name,
          email: socialUserInfo.email,
          passwordHash: null, // Social users don't have passwords
          emailVerified: true, // Social providers already verified the email
          role: Role.USER,
          status: UserStatus.ACTIVE,
          socialAccounts: [
            {
              provider: input.provider,
              providerAccountId: socialUserInfo.providerAccountId,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });

        user = await this.userRepository.create(user);
      }
    }

    if (!user.isActive) throw new UserInactiveError();

    if (user.mfaEnabled) {
      if (!this.mfaRepository || !this.mfaChallengeService || !user.mfaMethod) {
        throw new Error('MFA challenge services are not configured');
      }
      const availableMethods: MfaChallengeMethod[] = user.mfaMethod === 'TOTP'
        ? ['TOTP', 'EMAIL']
        : ['EMAIL'];
      if (await this.mfaRepository.countUnusedRecoveryCodes(user.id) > 0) {
        availableMethods.push('RECOVERY');
      }
      return {
        type: 'mfa_required',
        mfaToken: await this.mfaChallengeService.create(user.id, availableMethods),
        availableMethods,
      };
    }

    // 6. Create session & generate tokens
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
      method: loginMethod,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      deviceName,
      failReason: null,
    });

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
      isNewUser,
    };
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
