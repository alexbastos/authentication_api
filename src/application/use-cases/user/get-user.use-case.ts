// ─── Use Case: Get User ───────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface GetUserOutput {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  socialProviders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class GetUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<GetUserOutput> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      socialProviders: user.socialAccounts.map((sa) => sa.provider),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
