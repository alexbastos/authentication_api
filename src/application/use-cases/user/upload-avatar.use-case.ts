// ─── Use Case: Upload Avatar ──────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IStorageService } from '../../ports/storage.port.js';
import {
  UserNotFoundError,
  InvalidFileTypeError,
  FileTooLargeError,
  InvalidFileContentError,
} from '../../../domain/errors/domain-errors.js';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};

// Magic bytes for file type verification
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export interface UploadAvatarInput {
  userId: string;
  buffer: Buffer;
  mimeType: string;
  maxSizeMB: number;
}

export interface UploadAvatarOutput {
  avatarUrl: string;
  message: string;
}

export class UploadAvatarUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storageService: IStorageService,
  ) {}

  async execute(input: UploadAvatarInput): Promise<UploadAvatarOutput> {
    const { userId, buffer, mimeType, maxSizeMB } = input;

    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new InvalidFileTypeError();
    }

    // 2. Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      throw new FileTooLargeError(maxSizeMB);
    }

    // 3. Validate magic bytes (real file content)
    if (!this.isValidFileContent(buffer, mimeType)) {
      throw new InvalidFileContentError();
    }

    // 4. Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // 5. Delete previous avatar if exists
    const currentAvatarKey = user.profile.avatarUrl;
    if (currentAvatarKey && !currentAvatarKey.startsWith('http')) {
      try {
        await this.storageService.delete(currentAvatarKey);
      } catch {
        // If deletion fails, log but don't block the new upload
      }
    }

    // 6. Upload new avatar
    const extension = MIME_TO_EXTENSION[mimeType] ?? 'jpg';
    const key = `avatars/${userId}/${randomUUID()}.${extension}`;
    await this.storageService.upload(key, buffer, mimeType);

    // 7. Update user profile with the S3 key
    user.updateProfile({ avatarUrl: key });
    await this.userRepository.update(user);

    // 8. Generate signed URL for response
    const avatarUrl = await this.storageService.getSignedUrl(key);

    return {
      avatarUrl,
      message: 'Avatar uploaded successfully',
    };
  }

  private isValidFileContent(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 8) return false;

    if (mimeType === 'image/png') {
      return buffer.subarray(0, 8).equals(PNG_MAGIC);
    }

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      return buffer.subarray(0, 3).equals(JPEG_MAGIC);
    }

    return false;
  }
}
