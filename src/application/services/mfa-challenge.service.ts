import { randomUUID } from "node:crypto";
import {
	InvalidMfaCodeError,
	MfaAttemptsExceededError,
	MfaMethodNotAllowedError,
	MfaTokenInvalidError,
} from "../../domain/errors/domain-errors.js";
import type { ICacheProvider } from "../ports/cache.port.js";
import type { ITokenManager } from "../ports/token-manager.port.js";

export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

const MFA_CHALLENGE_PREFIX = "mfa_challenge:";
const MFA_CHALLENGE_ATTEMPTS_PREFIX = "mfa_challenge_attempts:";

export type MfaChallengeMethod = "TOTP" | "EMAIL" | "RECOVERY";

interface StoredMfaChallenge {
	userId: string;
	availableMethods: MfaChallengeMethod[];
}

export interface ActiveMfaChallenge extends StoredMfaChallenge {
	challengeId: string;
}

export class MfaChallengeService {
	constructor(
		private readonly tokenManager: ITokenManager,
		private readonly cacheProvider: ICacheProvider,
		private readonly maxAttempts: number = 5,
	) {}

	async create(
		userId: string,
		availableMethods: MfaChallengeMethod[],
	): Promise<string> {
		const challengeId = randomUUID();
		const challenge: StoredMfaChallenge = { userId, availableMethods };

		await this.cacheProvider.set(
			`${MFA_CHALLENGE_PREFIX}${challengeId}`,
			JSON.stringify(challenge),
			MFA_CHALLENGE_TTL_SECONDS,
		);

		return this.tokenManager.generateMfaToken({
			sub: userId,
			challengeId,
			expiresInSeconds: MFA_CHALLENGE_TTL_SECONDS,
		});
	}

	async getActive(mfaToken: string): Promise<ActiveMfaChallenge> {
		const payload = await this.tokenManager.verifyMfaToken(mfaToken);
		const serialized = await this.cacheProvider.get(
			`${MFA_CHALLENGE_PREFIX}${payload.challengeId}`,
		);
		if (!serialized) throw new MfaTokenInvalidError();

		try {
			const challenge = JSON.parse(serialized) as StoredMfaChallenge;
			if (
				challenge.userId !== payload.sub ||
				!Array.isArray(challenge.availableMethods)
			) {
				throw new MfaTokenInvalidError();
			}

			return {
				challengeId: payload.challengeId,
				userId: challenge.userId,
				availableMethods: challenge.availableMethods,
			};
		} catch (error) {
			if (error instanceof MfaTokenInvalidError) throw error;
			throw new MfaTokenInvalidError();
		}
	}

	assertMethodAllowed(
		challenge: ActiveMfaChallenge,
		method: MfaChallengeMethod,
	): void {
		if (!challenge.availableMethods.includes(method)) {
			throw new MfaMethodNotAllowedError();
		}
	}

	async rejectInvalidCode(challengeId: string): Promise<never> {
		const attempts = await this.cacheProvider.increment(
			`${MFA_CHALLENGE_ATTEMPTS_PREFIX}${challengeId}`,
			MFA_CHALLENGE_TTL_SECONDS,
		);

		if (attempts >= this.maxAttempts) {
			await Promise.all([
				this.cacheProvider.del(`${MFA_CHALLENGE_PREFIX}${challengeId}`),
				this.cacheProvider.del(
					`${MFA_CHALLENGE_ATTEMPTS_PREFIX}${challengeId}`,
				),
			]);
			throw new MfaAttemptsExceededError();
		}

		throw new InvalidMfaCodeError();
	}

	async consume(challengeId: string): Promise<void> {
		const challenge = await this.cacheProvider.getAndDelete(
			`${MFA_CHALLENGE_PREFIX}${challengeId}`,
		);
		if (!challenge) throw new MfaTokenInvalidError();
		await this.cacheProvider.del(
			`${MFA_CHALLENGE_ATTEMPTS_PREFIX}${challengeId}`,
		);
	}
}
