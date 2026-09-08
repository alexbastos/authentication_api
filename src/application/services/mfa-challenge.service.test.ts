import { describe, expect, it, vi } from "vitest";
import type { ICacheProvider } from "../ports/cache.port.js";
import type {
	ITokenManager,
	MfaTokenPayload,
} from "../ports/token-manager.port.js";
import {
	MFA_CHALLENGE_TTL_SECONDS,
	MfaChallengeService,
} from "./mfa-challenge.service.js";

class MemoryCache implements ICacheProvider {
	readonly values = new Map<string, string>();
	readonly counters = new Map<string, number>();

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
		this.counters.delete(key);
	}

	async exists(key: string): Promise<boolean> {
		return this.values.has(key);
	}

	async increment(key: string): Promise<number> {
		const value = (this.counters.get(key) ?? 0) + 1;
		this.counters.set(key, value);
		return value;
	}
}

function createTokenManager() {
	let challengeId = "";
	const generateMfaToken = vi.fn(
		async (input: {
			sub: string;
			challengeId: string;
			expiresInSeconds: number;
		}) => {
			challengeId = input.challengeId;
			return "signed-mfa-token";
		},
	);
	const verifyMfaToken = vi.fn(
		async (): Promise<MfaTokenPayload> => ({
			sub: "user-1",
			challengeId,
			tokenUse: "mfa",
			jti: "token-1",
			iat: 1,
			exp: 301,
			iss: "test",
			aud: "mfa-challenge",
		}),
	);

	return {
		manager: { generateMfaToken, verifyMfaToken } as unknown as ITokenManager,
		generateMfaToken,
	};
}

describe("MfaChallengeService", () => {
	it("creates a five-minute challenge tied to the user and attempt", async () => {
		const cache = new MemoryCache();
		const { manager, generateMfaToken } = createTokenManager();
		const service = new MfaChallengeService(manager, cache, 5);

		const token = await service.create("user-1", ["TOTP", "EMAIL", "RECOVERY"]);
		const challenge = await service.getActive(token);

		expect(token).toBe("signed-mfa-token");
		expect(challenge.userId).toBe("user-1");
		expect(challenge.availableMethods).toEqual(["TOTP", "EMAIL", "RECOVERY"]);
		expect(generateMfaToken).toHaveBeenCalledWith(
			expect.objectContaining({
				sub: "user-1",
				expiresInSeconds: MFA_CHALLENGE_TTL_SECONDS,
			}),
		);
	});

	it("allows a challenge to be consumed only once", async () => {
		const cache = new MemoryCache();
		const { manager } = createTokenManager();
		const service = new MfaChallengeService(manager, cache, 5);
		const token = await service.create("user-1", ["TOTP"]);
		const challenge = await service.getActive(token);

		await service.consume(challenge.challengeId);

		await expect(service.getActive(token)).rejects.toMatchObject({
			code: "MFA_TOKEN_INVALID",
		});
	});

	it("invalidates the challenge when the attempt limit is reached", async () => {
		const cache = new MemoryCache();
		const { manager } = createTokenManager();
		const service = new MfaChallengeService(manager, cache, 2);
		const token = await service.create("user-1", ["TOTP"]);
		const challenge = await service.getActive(token);

		await expect(
			service.rejectInvalidCode(challenge.challengeId),
		).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
		await expect(
			service.rejectInvalidCode(challenge.challengeId),
		).rejects.toMatchObject({ code: "MFA_ATTEMPTS_EXCEEDED" });
		await expect(service.getActive(token)).rejects.toMatchObject({
			code: "MFA_TOKEN_INVALID",
		});
	});

	it("rejects methods that were not offered for the attempt", async () => {
		const cache = new MemoryCache();
		const { manager } = createTokenManager();
		const service = new MfaChallengeService(manager, cache, 5);
		const token = await service.create("user-1", ["EMAIL"]);
		const challenge = await service.getActive(token);

		expect(() => service.assertMethodAllowed(challenge, "TOTP")).toThrowError(
			expect.objectContaining({ code: "MFA_METHOD_NOT_ALLOWED" }),
		);
	});
});
