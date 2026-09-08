// ─── Use Case: Update User ────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IStorageService } from '../../ports/storage.port.js';
import type { UserProfile, UserAddress } from '../../../domain/entities/user.entity.js';
import { resolveAvatarUrl } from '../../services/avatar-url.service.js';
import { Role } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  ForbiddenError,
} from '../../../domain/errors/domain-errors.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

export interface UpdateUserInput {
  userId: string;
  name?: string;
  role?: Role;
  requesterId: string;
  requesterRole: Role;
  // Profile fields
  phone?: string | null;
  birthDate?: Date | null;
  bio?: string | null;
  locale?: string | null;
  timezone?: string | null;
  address?: Partial<UserAddress>;
}

export interface UpdateUserOutput {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  updatedAt: Date;
  profile: UserProfile;
}

export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storageService: IStorageService,
    private readonly dispatchEventUC?: DispatchEventUseCase,
  ) {}

  async execute(input: UpdateUserInput): Promise<UpdateUserOutput> {
    // 1. Authorization check
    const isSelf = input.requesterId === input.userId;
    const isAdmin = input.requesterRole === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError('You can only update your own profile');
    }

    // Only admins can change roles
    if (input.role && !isAdmin) {
      throw new ForbiddenError('Only administrators can change user roles');
    }

    // 2. Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 3. Update fields
    if (input.name) {
      user.updateName(input.name);
    }

    if (input.role) {
      user.updateRole(input.role);
    }

    // 4. Update profile fields
    const hasProfileUpdate =
      input.phone !== undefined ||
      input.birthDate !== undefined ||
      input.bio !== undefined ||
      input.locale !== undefined ||
      input.timezone !== undefined ||
      input.address !== undefined;

    if (hasProfileUpdate) {
      user.updateProfile({
        phone: input.phone,
        birthDate: input.birthDate,
        bio: input.bio,
        locale: input.locale,
        timezone: input.timezone,
        address: input.address,
      });
    }

    const updatedUser = await this.userRepository.update(user);

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_UPDATED,
        payload: {
          userId: updatedUser.id,
          email: updatedUser.email,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
    }

    const profile = updatedUser.profile;
    profile.avatarUrl = await resolveAvatarUrl(profile.avatarUrl, this.storageService);

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
      profile,
    };
  }
}
