// ─── Use Case: Get User ───────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IStorageService } from '../../ports/storage.port.js';
import type { UserProfile } from '../../../domain/entities/user.entity.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';
import { ForbiddenError } from '../../../domain/errors/domain-errors.js';
import { Role } from '../../../domain/entities/role.entity.js';
import { resolveAvatarUrl } from '../../services/avatar-url.service.js';

export interface GetUserOutput {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  socialProviders: string[];
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetUserInput {
  userId: string;
  requesterId: string;
  requesterRole: Role;
}

export class GetUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storageService: IStorageService,
  ) {}

  async execute(input: GetUserInput): Promise<GetUserOutput> {
    if (input.requesterId !== input.userId && input.requesterRole !== Role.ADMIN) {
      throw new ForbiddenError('Users can only view their own profile');
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    const profile = user.profile;
    profile.avatarUrl = await resolveAvatarUrl(profile.avatarUrl, this.storageService);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      socialProviders: user.socialAccounts.map((sa) => sa.provider),
      profile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
