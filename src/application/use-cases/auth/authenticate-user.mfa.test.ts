import { describe, expect, it, vi } from "vitest";
import {
	MfaMethod,
	Role,
	UserStatus,
} from "../../../domain/entities/role.entity.js";
import { User } from "../../../domain/entities/user.entity.js";
import type { ICacheProvider } from "../../ports/cache.port.js";
import type {
	ITokenManager,
	MfaTokenPayload,
} from "../../ports/token-manager.port.js";
import { MfaChallengeService } from "../../services/mfa-challenge.service.js";
import { AuthenticateUserUseCase } from "./authenticate-user.use-case.js";

class AuthenticationTestCache implements ICacheProvider {
	private readonly values = new Map<string, string>();

	async set(key: string, value: string): Promise<void> {
		this.values.set(key, value);
	}

	async get(key: string): Promise<string | null> {
		return this.values.get(key) ?? null;
	}

	async getAndDelete(key: string): Promise<string | null> {
		const value = this.values.get(key) ?? null;
		this.values.delete(key);
		return value;
	}

	async del(key: string): Promise<void> {
		this.values.delete(key);
	}

	async exists(key: string): Promise<boolean> {
		return this.values.has(key);
	}

	async increment(): Promise<number> {
		return 1;
	}
}

describe("AuthenticateUserUseCase MFA result", () => {
	it("returns a discriminated challenge without creating session tokens", async () => {
		const user = new User({
			id: "user-1",
			name: "MFA User",
			email: "mfa@example.com",
			passwordHash: "hash",
			emailVerified: true,
			role: Role.USER,
			status: UserStatus.ACTIVE,
			socialAccounts: [],
			mfaEnabled: true,
			mfaMethod: MfaMethod.TOTP,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		const cache = new AuthenticationTestCache();
		let challengeId = "";
		const tokenManager = {
			generateAccessToken: vi.fn(),
			generateRefreshToken: vi.fn(),
			generateMfaToken: vi.fn(async (input: { challengeId: string }) => {
				challengeId = input.challengeId;
				return "temporary-mfa-token";
			}),
			verifyMfaToken: vi.fn(
				async (): Promise<MfaTokenPayload> => ({
					sub: user.id,
					challengeId,
					tokenUse: "mfa",
					jti: "mfa-jti",
					iat: 1,
					exp: 301,
					iss: "test",
					aud: "mfa-challenge",
				}),
			),
		} as unknown as ITokenManager;
		const challengeService = new MfaChallengeService(tokenManager, cache, 5);
		const refreshTokenRepository = { create: vi.fn() };
		const mfaRepository = {
			countUnusedRecoveryCodes: vi.fn().mockResolvedValue(2),
		};
		const useCase = new AuthenticateUserUseCase(
			{ findByEmail: vi.fn().mockResolvedValue(user) } as never,
			refreshTokenRepository as never,
			{ compare: vi.fn().mockResolvedValue(true) } as never,
			tokenManager,
			7,
			cache,
			5,
			15,
			undefined,
			undefined,
			undefined,
			undefined,
			mfaRepository as never,
			challengeService,
		);

		const result = await useCase.execute({
			email: user.email,
			password: "SecurePassword123!",
			identifier: "127.0.0.1",
		});

		expect(result).toEqual({
			type: "mfa_required",
			mfaToken: "temporary-mfa-token",
			availableMethods: ["TOTP", "EMAIL", "RECOVERY"],
		});
		expect(tokenManager.generateAccessToken).not.toHaveBeenCalled();
		expect(tokenManager.generateRefreshToken).not.toHaveBeenCalled();
		expect(refreshTokenRepository.create).not.toHaveBeenCalled();
	});
});
