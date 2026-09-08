import { describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "../../../domain/entities/role.entity.js";
import { User } from "../../../domain/entities/user.entity.js";
import type { IUserRepository } from "../../../domain/repositories/user.repository.js";
import type { IStorageService } from "../../ports/storage.port.js";
import { AVATAR_URL_TTL_SECONDS } from "../../services/avatar-url.service.js";
import { DeleteAvatarUseCase } from "./delete-avatar.use-case.js";
import { GetUserUseCase } from "./get-user.use-case.js";
import { UploadAvatarUseCase } from "./upload-avatar.use-case.js";

function createUser(avatarUrl: string | null) {
	return new User({
		id: "user-1",
		name: "Avatar User",
		email: "avatar@example.com",
		passwordHash: "hash",
		emailVerified: true,
		role: Role.USER,
		status: UserStatus.ACTIVE,
		socialAccounts: [],
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		avatarUrl,
	});
}

function createDependencies(user: User) {
	const repository = {
		findById: vi.fn().mockResolvedValue(user),
		update: vi.fn().mockResolvedValue(user),
	} as unknown as IUserRepository;
	const storage = {
		getSignedUrl: vi
			.fn()
			.mockResolvedValueOnce("https://storage.example/avatar.png?signature=one")
			.mockResolvedValueOnce(
				"https://storage.example/avatar.png?signature=two",
			),
		delete: vi.fn().mockResolvedValue(undefined),
	} as unknown as IStorageService;

	return { repository, storage };
}

describe("GetUserUseCase avatar URL", () => {
	it("returns a newly signed seven-day URL on every read without replacing the stored key", async () => {
		const user = createUser("avatars/user-1/avatar.png");
		const { repository, storage } = createDependencies(user);
		const useCase = new GetUserUseCase(repository, storage);

		const authorization = {
			userId: user.id,
			requesterId: user.id,
			requesterRole: Role.USER,
		};
		const first = await useCase.execute(authorization);
		const second = await useCase.execute(authorization);

		expect(first.profile.avatarUrl).toContain("signature=one");
		expect(second.profile.avatarUrl).toContain("signature=two");
		expect(storage.getSignedUrl).toHaveBeenNthCalledWith(
			1,
			"avatars/user-1/avatar.png",
			AVATAR_URL_TTL_SECONDS,
		);
		expect(storage.getSignedUrl).toHaveBeenCalledTimes(2);
		expect(user.profile.avatarUrl).toBe("avatars/user-1/avatar.png");
	});

	it("keeps external provider avatar URLs unchanged", async () => {
		const externalUrl = "https://provider.example/avatar.png";
		const user = createUser(externalUrl);
		const { repository, storage } = createDependencies(user);
		const useCase = new GetUserUseCase(repository, storage);

		const result = await useCase.execute({
			userId: user.id,
			requesterId: user.id,
			requesterRole: Role.USER,
		});

		expect(result.profile.avatarUrl).toBe(externalUrl);
		expect(storage.getSignedUrl).not.toHaveBeenCalled();
	});
});

describe("DeleteAvatarUseCase idempotency", () => {
	it("returns success without storage or repository writes when the avatar is already absent", async () => {
		const user = createUser(null);
		const { repository, storage } = createDependencies(user);
		const useCase = new DeleteAvatarUseCase(repository, storage);

		const result = await useCase.execute({ userId: user.id });

		expect(result).toEqual({ message: "Avatar removed successfully" });
		expect(storage.delete).not.toHaveBeenCalled();
		expect(repository.update).not.toHaveBeenCalled();
	});

	it("deletes an existing stored object and clears its reference", async () => {
		const user = createUser("avatars/user-1/avatar.png");
		const { repository, storage } = createDependencies(user);
		const useCase = new DeleteAvatarUseCase(repository, storage);

		const result = await useCase.execute({ userId: user.id });

		expect(result).toEqual({ message: "Avatar removed successfully" });
		expect(storage.delete).toHaveBeenCalledWith("avatars/user-1/avatar.png");
		expect(repository.update).toHaveBeenCalledWith(user);
		expect(
			(repository.update as ReturnType<typeof vi.fn>).mock
				.invocationCallOrder[0],
		).toBeLessThan(
			(storage.delete as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
		);
		expect(user.profile.avatarUrl).toBeNull();
	});
});

describe("UploadAvatarUseCase failure consistency", () => {
	it("does not delete the previous object when persisting its replacement fails", async () => {
		const user = createUser("avatars/user-1/previous.png");
		const repository = {
			findById: vi.fn().mockResolvedValue(user),
			update: vi.fn().mockRejectedValue(new Error("database unavailable")),
		};
		const storage = {
			upload: vi.fn().mockResolvedValue(undefined),
			getSignedUrl: vi
				.fn()
				.mockResolvedValue("https://storage.example/new.png?signed=true"),
			delete: vi.fn().mockResolvedValue(undefined),
		};
		const useCase = new UploadAvatarUseCase(
			repository as never,
			storage as never,
		);

		await expect(
			useCase.execute({
				userId: user.id,
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
				mimeType: "image/png",
				maxSizeMB: 5,
			}),
		).rejects.toThrow("database unavailable");

		expect(storage.delete).not.toHaveBeenCalledWith(
			"avatars/user-1/previous.png",
		);
		expect(storage.delete).toHaveBeenCalledOnce();
	});
});
