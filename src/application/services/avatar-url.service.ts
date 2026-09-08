import type { IStorageService } from "../ports/storage.port.js";

export const AVATAR_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function resolveAvatarUrl(
	avatarReference: string | null,
	storageService: IStorageService,
): Promise<string | null> {
	if (!avatarReference || /^https?:\/\//i.test(avatarReference)) {
		return avatarReference;
	}

	return storageService.getSignedUrl(avatarReference, AVATAR_URL_TTL_SECONDS);
}
