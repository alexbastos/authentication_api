// ─── Use Case: OIDC UserInfo ────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UserInfoInput {
  userId: string;
  scopes: string[];
}

export interface UserInfoOutput {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  updated_at?: number;
  [key: string]: any;
}

export class UserInfoUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UserInfoInput): Promise<UserInfoOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError('User not found');

    const claims: UserInfoOutput = {
      sub: user.id,
    };

    if (input.scopes.includes('profile')) {
      claims.name = user.name;
      claims.updated_at = Math.floor(user.updatedAt.getTime() / 1000);
    }

    if (input.scopes.includes('email')) {
      claims.email = user.email;
      claims.email_verified = user.emailVerified;
    }

    // Role mapping into claims could also be done here

    return claims;
  }
}
