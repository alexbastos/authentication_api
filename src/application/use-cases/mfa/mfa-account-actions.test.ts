import { describe, expect, it, vi } from "vitest";
import {
	MfaMethod,
	Role,
	UserStatus,
} from "../../../domain/entities/role.entity.js";
import { User } from "../../../domain/entities/user.entity.js";
import { DisableMfaUseCase } from "./disable-mfa.use-case.js";
import { RegenerateRecoveryCodesUseCase } from "./regenerate-recovery-codes.use-case.js";
import { SendMfaEmailCodeUseCase } from "./send-mfa-email-code.use-case.js";
import { ValidateMfaCodeUseCase } from "./validate-mfa-code.use-case.js";

function createEmailMfaUser() {
	return new User({
		id: "user-1",
		name: "MFA User",
		email: "mfa@example.com",
		passwordHash: "hash",
		emailVerified: true,
		role: Role.USER,
		status: UserStatus.ACTIVE,
		socialAccounts: [],
		mfaEnabled: true,
		mfaMethod: MfaMethod.EMAIL,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

describe("MFA account actions for EMAIL accounts", () => {
	it("allows EMAIL verification when disabling MFA", async () => {
		const user = createEmailMfaUser();
		const validate = { execute: vi.fn().mockResolvedValue({ valid: true }) };
		const userRepository = {
			findById: vi.fn().mockResolvedValue(user),
			update: vi.fn(),
		};
		const mfaRepository = {
			disableAndRevokeSessions: vi.fn(),
		};
		const useCase = new DisableMfaUseCase(
			userRepository as never,
			mfaRepository as never,
			validate as never,
		);

		await expect(
			useCase.execute({ userId: user.id, code: "123456", method: "EMAIL" }),
		).resolves.toEqual({
			message: "Two-factor authentication has been disabled.",
		});
		expect(validate.execute).toHaveBeenCalledWith({
			userId: user.id,
			code: "123456",
			method: "EMAIL",
		});
		expect(mfaRepository.disableAndRevokeSessions).toHaveBeenCalledWith(
			user.id,
		);
	});

	it("allows EMAIL verification when regenerating recovery codes", async () => {
		const user = createEmailMfaUser();
		const validate = { execute: vi.fn().mockResolvedValue({ valid: true }) };
		const mfaRepository = {
			replaceRecoveryCodes: vi.fn(),
		};
		const useCase = new RegenerateRecoveryCodesUseCase(
			{ findById: vi.fn().mockResolvedValue(user) } as never,
			mfaRepository as never,
			{ hash: vi.fn(async (value: string) => `hash:${value}`) } as never,
			validate as never,
		);

		const result = await useCase.execute({
			userId: user.id,
			code: "123456",
			method: "EMAIL",
		});

		expect(validate.execute).toHaveBeenCalledWith({
			userId: user.id,
			code: "123456",
			method: "EMAIL",
		});
		expect(result.recoveryCodes).toHaveLength(10);
		expect(mfaRepository.replaceRecoveryCodes).toHaveBeenCalledOnce();
		expect(
			result.recoveryCodes.every((code) =>
				/^[0-9A-F]{8}-[0-9A-F]{8}$/.test(code),
			),
		).toBe(true);
	});

	it("rate-limits repeated email code requests with a stable error code", async () => {
		const user = createEmailMfaUser();
		const values = new Map<string, string>();
		const cache = {
			setIfNotExists: vi.fn(async (key: string, value: string) => {
				if (values.has(key)) return false;
				values.set(key, value);
				return true;
			}),
			set: vi.fn(async (key: string, value: string) => {
				values.set(key, value);
			}),
		};
		const emailService = { sendMfaCode: vi.fn() };
		const useCase = new SendMfaEmailCodeUseCase(
			{ findById: vi.fn().mockResolvedValue(user) } as never,
			emailService as never,
			cache as never,
			10,
		);

		const attempts = await Promise.allSettled([
			useCase.execute({ userId: user.id, accountAction: true }),
			useCase.execute({ userId: user.id, accountAction: true }),
		]);

		expect(emailService.sendMfaCode).toHaveBeenCalledOnce();
		expect(
			attempts.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			attempts.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		expect(
			attempts.find((result) => result.status === "rejected"),
		).toMatchObject({
			reason: { code: "MFA_RATE_LIMITED" },
		});
	});

	it("locks MFA verification after the configured per-account attempt limit", async () => {
		const values = new Map<string, number>();
		const cache = {
			get: vi.fn(async (key: string) =>
				values.has(key) ? String(values.get(key)) : null,
			),
			increment: vi.fn(async (key: string) => {
				const value = (values.get(key) ?? 0) + 1;
				values.set(key, value);
				return value;
			}),
			del: vi.fn(async (key: string) => {
				values.delete(key);
			}),
		};
		const useCase = new ValidateMfaCodeUseCase(
			{
				findSecretByUserId: vi.fn().mockResolvedValue({
					secret: "TOTP-SECRET",
					verified: true,
				}),
			} as never,
			{ verifyToken: vi.fn().mockReturnValue(false) } as never,
			{} as never,
			cache as never,
			undefined,
			3,
		);

		await expect(
			useCase.execute({ userId: "user-1", code: "000001", method: "TOTP" }),
		).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
		await expect(
			useCase.execute({ userId: "user-1", code: "000002", method: "TOTP" }),
		).rejects.toMatchObject({ code: "MFA_CODE_INVALID" });
		await expect(
			useCase.execute({ userId: "user-1", code: "000003", method: "TOTP" }),
		).rejects.toMatchObject({ code: "MFA_ATTEMPTS_EXCEEDED" });
		await expect(
			useCase.execute({ userId: "user-1", code: "000004", method: "TOTP" }),
		).rejects.toMatchObject({ code: "MFA_ATTEMPTS_EXCEEDED" });
	});
});
