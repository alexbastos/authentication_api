import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationCode } from "../../domain/entities/authorization-code.entity.js";
import { ClientApp } from "../../domain/entities/client-app.entity.js";
import { RefreshToken } from "../../domain/entities/refresh-token.entity.js";
import {
	MfaMethod,
	Role,
	SocialProvider,
	UserStatus,
} from "../../domain/entities/role.entity.js";
import { OrgRole } from "../../domain/entities/role.entity.js";
import { User } from "../../domain/entities/user.entity.js";
import { WebhookEvent } from "../../domain/entities/webhook.entity.js";
import { AesGcmDataProtector } from "../../infrastructure/security/aes-gcm-data-protector.js";
import { SecureTokenService } from "../../infrastructure/security/secure-token.service.js";
import { SecureWebhookUrlValidator } from "../../infrastructure/webhook/webhook-url-validator.js";
import { AuthenticateSocialUseCase } from "./auth/authenticate-social.use-case.js";
import { RefreshTokenUseCase } from "./auth/refresh-token.use-case.js";
import { RevokeTokenUseCase } from "./auth/revoke-token.use-case.js";
import { ValidateMfaCodeUseCase } from "./mfa/validate-mfa-code.use-case.js";
import { AuthorizeUseCase } from "./oauth/authorize.use-case.js";
import { TokenExchangeUseCase } from "./oauth/token-exchange.use-case.js";
import { ChangeMemberRoleUseCase } from "./organization/change-member-role.use-case.js";
import { ListOrganizationMembersUseCase } from "./organization/list-organization-members.use-case.js";
import { GetUserUseCase } from "./user/get-user.use-case.js";
import { DispatchEventUseCase } from "./webhook/dispatch-event.use-case.js";

function user(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) {
	return new User({
		id: "user-1",
		name: "User",
		email: "user@example.com",
		passwordHash: "hash",
		emailVerified: true,
		role: Role.USER,
		status: UserStatus.ACTIVE,
		socialAccounts: [],
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});
}

function client() {
	return new ClientApp({
		id: "client-db-id",
		name: "Client",
		clientId: "client-id",
		clientSecret: "hash",
		redirectUrls: ["https://client.example/callback"],
		isActive: true,
		grantTypes: ["authorization_code"],
		scopes: ["openid"],
		tokenEndpointAuth: "none",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

describe("authorization boundaries", () => {
	it("rejects reading another user before querying their record", async () => {
		const repository = { findById: vi.fn() };
		const useCase = new GetUserUseCase(repository as never, {} as never);
		await expect(
			useCase.execute({
				userId: "victim",
				requesterId: "attacker",
				requesterRole: Role.USER,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(repository.findById).not.toHaveBeenCalled();
	});

	it("rejects listing members for a non-member tenant identity", async () => {
		const repository = {
			findById: vi.fn().mockResolvedValue({ id: "org-1" }),
			findMember: vi.fn().mockResolvedValue(null),
			listMembers: vi.fn(),
		};
		const useCase = new ListOrganizationMembersUseCase(repository as never);
		await expect(useCase.execute("org-1", "attacker")).rejects.toMatchObject({
			code: "NOT_ORGANIZATION_MEMBER",
		});
		expect(repository.listMembers).not.toHaveBeenCalled();
	});

	it("rejects assigning OWNER outside a dedicated ownership-transfer flow", async () => {
		const repository = {
			findById: vi.fn(),
			findMember: vi.fn(),
			updateMemberRole: vi.fn(),
		};
		const useCase = new ChangeMemberRoleUseCase(repository as never);

		await expect(
			useCase.execute({
				orgId: "org-1",
				targetUserId: "target",
				requesterId: "owner",
				newRole: OrgRole.OWNER,
			}),
		).rejects.toMatchObject({ code: "CANNOT_ASSIGN_OWNER" });
		expect(repository.findById).not.toHaveBeenCalled();
	});
});

describe("OAuth one-time grants and PKCE", () => {
	const secureTokens = new SecureTokenService();
	const verifier = "A".repeat(43);
	const challenge = createHash("sha256").update(verifier).digest("base64url");

	it("requires S256 and persists only the authorization-code digest", async () => {
		const create = vi.fn(async (value) => value);
		const useCase = new AuthorizeUseCase(
			{ findByClientId: vi.fn().mockResolvedValue(client()) } as never,
			{ create } as never,
			{
				findByUserAndClient: vi
					.fn()
					.mockResolvedValue({ hasScopes: () => true }),
			} as never,
			secureTokens,
		);
		await expect(
			useCase.execute({
				userId: "user-1",
				clientId: "client-id",
				responseType: "code",
				redirectUri: "https://client.example/callback",
				codeChallenge: challenge,
				codeChallengeMethod: "plain",
				scope: "openid",
				state: "random-state-value",
			}),
		).rejects.toMatchObject({ code: "INVALID_CODE_CHALLENGE" });

		const result = await useCase.execute({
			userId: "user-1",
			clientId: "client-id",
			responseType: "code",
			redirectUri: "https://client.example/callback",
			codeChallenge: challenge,
			codeChallengeMethod: "S256",
			scope: "openid",
			state: "random-state-value",
		});
		const stored = create.mock.calls[0][0] as AuthorizationCode;
		if (!result.code) throw new Error("Authorization code was not issued");
		expect(stored.code).toBe(secureTokens.digest(result.code));
		expect(stored.code).not.toBe(result.code);
	});

	it("allows only one concurrent authorization-code exchange", async () => {
		const authorizationCode = new AuthorizationCode({
			id: "code-id",
			code: secureTokens.digest("plain-code"),
			clientId: "client-db-id",
			userId: "user-1",
			redirectUri: "https://client.example/callback",
			scope: "openid",
			codeChallenge: challenge,
			codeChallengeMethod: "S256",
			nonce: "nonce",
			expiresAt: new Date(Date.now() + 60_000),
			usedAt: null,
			createdAt: new Date(),
		});
		let available = true;
		const consume = vi.fn(async () => {
			if (!available) return false;
			available = false;
			return true;
		});
		const useCase = new TokenExchangeUseCase(
			{
				findByCode: vi.fn().mockResolvedValue(authorizationCode),
				consume,
			} as never,
			{ findById: vi.fn().mockResolvedValue(client()) } as never,
			{ findById: vi.fn().mockResolvedValue(user()) } as never,
			{
				generateAccessToken: vi.fn().mockResolvedValue("access"),
				generateIdToken: vi.fn().mockResolvedValue("id"),
			} as never,
			{ compare: vi.fn() } as never,
			secureTokens,
			900,
		);
		const input = {
			grantType: "authorization_code",
			code: "plain-code",
			redirectUri: "https://client.example/callback",
			clientId: "client-id",
			codeVerifier: verifier,
			clientAuthMethod: "none" as const,
		};
		const results = await Promise.allSettled([
			useCase.execute(input),
			useCase.execute(input),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
	});
});

describe("refresh rotation", () => {
	it("stores the replacement as a digest and rejects the concurrent loser", async () => {
		const secureTokens = new SecureTokenService();
		const current = new RefreshToken({
			id: "refresh-1",
			token: secureTokens.digest("raw-refresh"),
			userId: "user-1",
			family: "family-1",
			userAgent: null,
			ipAddress: null,
			deviceName: null,
			expiresAt: new Date(Date.now() + 60_000),
			createdAt: new Date(),
			revokedAt: null,
		});
		let available = true;
		const replacements: RefreshToken[] = [];
		const repository = {
			findByToken: vi.fn().mockResolvedValue(current),
			rotate: vi.fn(async (_id: string, replacement: RefreshToken) => {
				if (!available) return false;
				available = false;
				replacements.push(replacement);
				return true;
			}),
			revokeAllByFamily: vi.fn(),
		};
		let counter = 0;
		const useCase = new RefreshTokenUseCase(
			{ findById: vi.fn().mockResolvedValue(user()) } as never,
			repository as never,
			{
				generateRefreshToken: () => `new-raw-refresh-${++counter}`,
				generateAccessToken: vi.fn().mockResolvedValue("access"),
			} as never,
			7,
			undefined,
			undefined,
			secureTokens,
		);
		const results = await Promise.allSettled([
			useCase.execute({ refreshToken: "raw-refresh" }),
			useCase.execute({ refreshToken: "raw-refresh" }),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		expect(replacements[0].token).toHaveLength(64);
		expect(replacements[0].token).not.toContain("new-raw-refresh");
	});
});

describe("logout session binding", () => {
	it("revokes the signed session family instead of trusting the body token", async () => {
		const revokeSessionAndTokens = vi.fn().mockResolvedValue(undefined);
		const set = vi.fn().mockResolvedValue(undefined);
		const useCase = new RevokeTokenUseCase(
			{
				verifyAccessToken: vi.fn().mockResolvedValue({
					sub: "user-1",
					sid: "session-1",
					jti: "jti-1",
					exp: Math.floor(Date.now() / 1000) + 60,
				}),
			} as never,
			{ set } as never,
			{ revokeSessionAndTokens } as never,
		);

		await useCase.execute({
			accessToken: "signed-access-token",
			refreshToken: "untrusted-body-value",
		});

		expect(revokeSessionAndTokens).toHaveBeenCalledWith("user-1", "session-1");
		expect(set).toHaveBeenCalledWith(
			"blocklist:jti-1",
			"1",
			expect.any(Number),
		);
	});
});

describe("MFA and secret protection", () => {
	it("does not bypass MFA during social login", async () => {
		const mfaUser = user({ mfaEnabled: true, mfaMethod: MfaMethod.TOTP });
		const generateAccessToken = vi.fn();
		const useCase = new AuthenticateSocialUseCase(
			{ findByProvider: vi.fn().mockResolvedValue(mfaUser) } as never,
			{} as never,
			{ generateAccessToken } as never,
			{
				getProvider: () => ({
					getUserInfo: vi.fn().mockResolvedValue({
						providerAccountId: "social-1",
						email: mfaUser.email,
					}),
				}),
			} as never,
			7,
			undefined,
			undefined,
			undefined,
			undefined,
			{ countUnusedRecoveryCodes: vi.fn().mockResolvedValue(1) } as never,
			{ create: vi.fn().mockResolvedValue("mfa-token") } as never,
		);
		await expect(
			useCase.execute({
				provider: SocialProvider.GOOGLE,
				token: "provider-token",
			}),
		).resolves.toEqual({
			type: "mfa_required",
			mfaToken: "mfa-token",
			availableMethods: ["TOTP", "EMAIL", "RECOVERY"],
		});
		expect(generateAccessToken).not.toHaveBeenCalled();
	});

	it("encrypts sensitive values with authenticated encryption", () => {
		const protector = new AesGcmDataProtector("ab".repeat(32));
		const protectedValue = protector.protect("TOTP-SECRET");
		expect(protectedValue).not.toContain("TOTP-SECRET");
		expect(protector.unprotect(protectedValue)).toBe("TOTP-SECRET");
	});

	it("allows a recovery code to be consumed only once under concurrency", async () => {
		let available = true;
		const useCase = new ValidateMfaCodeUseCase(
			{
				findSecretByUserId: vi
					.fn()
					.mockResolvedValue({ secret: "protected", verified: true }),
				findRecoveryCodesByUserId: vi
					.fn()
					.mockResolvedValue([
						{ id: "recovery-1", codeHash: "hash", isUsed: false },
					]),
				consumeRecoveryCode: vi.fn(async () => {
					if (!available) return false;
					available = false;
					return true;
				}),
			} as never,
			{} as never,
			{ compare: vi.fn().mockResolvedValue(true) } as never,
			{
				get: vi.fn().mockResolvedValue(null),
				increment: vi.fn().mockResolvedValue(1),
				del: vi.fn().mockResolvedValue(undefined),
			} as never,
		);

		const attempts = await Promise.allSettled([
			useCase.execute({
				userId: "user-1",
				code: "RECOVERY",
				method: "RECOVERY",
			}),
			useCase.execute({
				userId: "user-1",
				code: "RECOVERY",
				method: "RECOVERY",
			}),
		]);

		expect(
			attempts.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			attempts.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
	});

	it.each([
		"http://example.com/hook",
		"https://localhost/hook",
		"https://127.0.0.1/hook",
		"https://169.254.169.254/latest/meta-data",
		"https://[::1]/hook",
	])("blocks webhook SSRF destination %s", async (url) => {
		await expect(
			new SecureWebhookUrlValidator().assertAllowed(url),
		).rejects.toMatchObject({ code: "INVALID_WEBHOOK_URL" });
	});
});

describe("webhook tenant boundaries", () => {
	it("passes an explicit organization boundary to endpoint selection", async () => {
		const findActiveEndpointsByEvent = vi.fn().mockResolvedValue([]);
		const useCase = new DispatchEventUseCase(
			{ findActiveEndpointsByEvent } as never,
			{} as never,
		);

		await useCase.execute({
			event: WebhookEvent.ORG_MEMBER_ADDED,
			organizationId: "org-1",
			payload: { organizationId: "org-1", userId: "user-1" },
		});

		expect(findActiveEndpointsByEvent).toHaveBeenCalledWith(
			WebhookEvent.ORG_MEMBER_ADDED,
			"org-1",
		);
	});
});
