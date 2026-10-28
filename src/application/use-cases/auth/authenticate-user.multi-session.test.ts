import { describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "../../../domain/entities/role.entity.js";
import { User } from "../../../domain/entities/user.entity.js";
import { AuthenticateUserUseCase } from "./authenticate-user.use-case.js";

describe("AuthenticateUserUseCase multi-application sessions", () => {
	it("keeps independently created sessions active for the same user", async () => {
		const user = new User({
			id: "multi-app-user",
			name: "Synthetic multi-app user",
			email: "multi-app@example.com",
			passwordHash: "password-hash",
			emailVerified: true,
			role: Role.USER,
			status: UserStatus.ACTIVE,
			socialAccounts: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		const sessions: Array<{ id: string; family: string; userId: string }> = [];
		const accessClaims: Array<{ sid?: string; aud?: string }> = [];
		const tokenManager = {
			generateAccessToken: vi.fn(
				async (claims: { sid?: string; aud?: string }) => {
					accessClaims.push(claims);
					return `access-${accessClaims.length}`;
				},
			),
			generateRefreshToken: vi.fn(() => `refresh-${sessions.length + 1}`),
		};
		const useCase = new AuthenticateUserUseCase(
			{ findByEmail: vi.fn().mockResolvedValue(user) } as never,
			{ create: vi.fn().mockResolvedValue(undefined) } as never,
			{ compare: vi.fn().mockResolvedValue(true) } as never,
			tokenManager as never,
			7,
			undefined,
			5,
			15,
			undefined,
			undefined,
			{
				create: vi.fn(
					async (session: { id: string; family: string; userId: string }) => {
						sessions.push(session);
						return session;
					},
				),
			} as never,
		);

		const firstLogin = await useCase.execute({
			email: user.email,
			password: "SecurePassword123!",
			userAgent: "Synthetic VetOrthoPlan client",
		});
		const secondLogin = await useCase.execute({
			email: user.email,
			password: "SecurePassword123!",
			userAgent: "Synthetic CaptaGov client",
		});

		expect(firstLogin.type).toBe("authenticated");
		expect(secondLogin.type).toBe("authenticated");
		expect(sessions).toHaveLength(2);
		expect(sessions[0].id).not.toBe(sessions[1].id);
		expect(sessions[0].family).not.toBe(sessions[1].family);
		expect(sessions.every((session) => session.userId === user.id)).toBe(true);
		expect(accessClaims.map((claims) => claims.sid)).toEqual(
			sessions.map((session) => session.id),
		);
	});
});
