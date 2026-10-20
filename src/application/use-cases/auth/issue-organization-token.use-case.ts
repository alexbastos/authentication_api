import { v4 as uuidv4 } from 'uuid';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { IGeoIpService } from '../../ports/geo-ip.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { Session } from '../../../domain/entities/session.entity.js';
import {
  NotOrganizationMemberError,
  OrganizationNotFoundError,
} from '../../../domain/errors/domain-errors.js';
import { parseDeviceName } from '../../services/device-name.service.js';

export interface IssueOrganizationTokenInput {
  userId: string;
  email: string;
  role: Role;
  organizationId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface IssueOrganizationTokenOutput {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  expiresIn: number;
}

export class IssueOrganizationTokenUseCase {
  constructor(
    private readonly organizationRepository: IOrganizationRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenManager: ITokenManager,
    private readonly geoIpService: IGeoIpService,
    private readonly secureTokenService: ISecureTokenService,
    private readonly audience: string,
    private readonly refreshTokenExpiryDays: number,
    private readonly accessTokenTtlSeconds: number,
  ) {}

  async execute(input: IssueOrganizationTokenInput): Promise<IssueOrganizationTokenOutput> {
    const organization = await this.organizationRepository.findById(input.organizationId);
    if (!organization || !organization.isActive) {
      throw new OrganizationNotFoundError(input.organizationId);
    }

    const membership = await this.organizationRepository.findMember(
      input.organizationId,
      input.userId,
    );
    if (!membership) throw new NotOrganizationMemberError();

    const family = uuidv4();
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);
    const ipAddress = input.ipAddress ?? null;
    const userAgent = input.userAgent ?? null;
    const refreshTokenValue = this.tokenManager.generateRefreshToken();
    const location = this.geoIpService.lookup(ipAddress ?? '') ?? null;
    const session = new Session({
      id: sessionId,
      userId: input.userId,
      family,
      deviceName: parseDeviceName(userAgent),
      userAgent,
      ipAddress,
      location,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
    });

    await this.sessionRepository.create(session);
    try {
      const accessToken = await this.tokenManager.generateAccessToken({
        sub: input.userId,
        email: input.email,
        role: input.role,
        sid: sessionId,
        aud: this.audience,
        organizationId: organization.id,
      });
      await this.refreshTokenRepository.create(new RefreshToken({
        id: uuidv4(),
        token: this.secureTokenService.digest(refreshTokenValue),
        userId: input.userId,
        family,
        audience: this.audience,
        organizationId: organization.id,
        userAgent,
        ipAddress,
        deviceName: parseDeviceName(userAgent),
        expiresAt,
        createdAt: now,
        revokedAt: null,
      }));

      return {
        accessToken,
        refreshToken: refreshTokenValue,
        organizationId: organization.id,
        expiresIn: this.accessTokenTtlSeconds,
      };
    } catch (error) {
      await this.sessionRepository.revokeByFamily(family);
      throw error;
    }
  }
}
