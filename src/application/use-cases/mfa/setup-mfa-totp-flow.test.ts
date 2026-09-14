import * as OTPAuth from "otpauth";
import { describe, expect, it, vi } from "vitest";
import type { MfaRecoveryCode } from "../../../domain/entities/mfa-recovery-code.entity.js";
import type { MfaSecret } from "../../../domain/entities/mfa-secret.entity.js";
import {
	MfaMethod,
	Role,
	UserStatus,
} from "../../../domain/entities/role.entity.js";
import { User } from "../../../domain/entities/user.entity.js";
import { TotpService } from "../../../infrastructure/security/totp.service.js";
import { SetupMfaUseCase } from "./setup-mfa.use-case.js";
import { VerifyMfaSetupUseCase } from "./verify-mfa-setup.use-case.js";

describe("TOTP setup flow", () => {
	it("persists the QR secret for the Bearer user and verifies its current code", async () => {
		const user = new User({
			id: "user-1",
			name: "MFA User",
			email: "mfa@example.com",
			passwordHash: "hash",
			emailVerified: true,
			role: Role.USER,
			status: UserStatus.ACTIVE,
			socialAccounts: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		let pendingSecret: MfaSecret | null = null;
		let completedSetup:
			| {
					userId: string;
					secretId: string;
					method: MfaMethod;
					recoveryCodes: MfaRecoveryCode[];
			  }
			| undefined;

		const userRepository = {
			findById: vi.fn(async (userId: string) =>
				userId === user.id ? user : null,
			),
		};
		const mfaRepository = {
			replacePendingSecret: vi.fn(async (secret: MfaSecret) => {
				pendingSecret = secret;
				return secret;
			}),
			findSecretByUserId: vi.fn(async (userId: string) =>
				pendingSecret?.userId === userId ? pendingSecret : null,
			),
			completeSetup: vi.fn(
				async (
					userId: string,
					secretId: string,
					method: MfaMethod,
					recoveryCodes: MfaRecoveryCode[],
				) => {
					completedSetup = { userId, secretId, method, recoveryCodes };
					return pendingSecret?.id === secretId;
				},
			),
		};
		const replayedCodes = new Set<string>();
		const cacheProvider = {
			setIfNotExists: vi.fn(async (key: string) => {
				if (replayedCodes.has(key)) return false;
				replayedCodes.add(key);
				return true;
			}),
		};
		const totpService = new TotpService();
		const setup = new SetupMfaUseCase(
			userRepository as never,
			mfaRepository as never,
			totpService,
			{} as never,
			cacheProvider as never,
		);
		const verify = new VerifyMfaSetupUseCase(
			userRepository as never,
			mfaRepository as never,
			totpService,
			{ hash: vi.fn(async (value: string) => `hash:${value}`) } as never,
			cacheProvider as never,
		);

		const setupResult = await setup.execute({
			userId: user.id,
			method: MfaMethod.TOTP,
		});
		// Google Authenticator reads the same provisioning URI used to create the
		// QR image. Reconstruct it from the returned manual secret so this test
		// exercises the code a real authenticator would generate.
		if (!setupResult.secret)
			throw new Error("TOTP setup did not return a secret");
		const authenticator = new OTPAuth.TOTP({
			issuer: "AuthenticationAPI",
			label: user.email,
			algorithm: "SHA1",
			digits: 6,
			period: 30,
			secret: OTPAuth.Secret.fromBase32(setupResult.secret),
		});
		const token = authenticator.generate();
		const result = await verify.execute({ userId: user.id, code: token });

		expect(setupResult.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
		expect(pendingSecret?.secret).toBe(setupResult.secret);
		expect(result.recoveryCodes).toHaveLength(10);
		expect(completedSetup).toMatchObject({
			userId: user.id,
			secretId: pendingSecret?.id,
			method: MfaMethod.TOTP,
		});
		expect(completedSetup?.recoveryCodes).toHaveLength(10);
	});
});
