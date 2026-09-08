import { describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "../../../domain/entities/role.entity.js";
import { User } from "../../../domain/entities/user.entity.js";
import { createAuthMiddleware } from "./auth.middleware.js";

function activeUser(role = Role.USER) {
	return new User({
		id: "user-1",
		name: "Current User",
		email: "current@example.com",
		passwordHash: "hash",
		emailVerified: true,
		role,
		status: UserStatus.ACTIVE,
		socialAccounts: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function replyDouble() {
	const reply = {
		statusCode: 0,
		payload: undefined as unknown,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		send(payload: unknown) {
			this.payload = payload;
			return this;
		},
	};
	return reply;
}

const tokenPayload = {
	sub: "user-1",
	email: "stale@example.com",
	role: Role.USER,
	sid: "session-1",
	jti: "token-1",
	iat: 1,
	exp: 9999999999,
	iss: "issuer",
	aud: "authentication-api",
	tokenUse: "access" as const,
};

describe("authentication middleware session enforcement", () => {
	it("rejects an access token whose logical session was revoked", async () => {
		const middleware = createAuthMiddleware(
			{ verifyAccessToken: vi.fn().mockResolvedValue(tokenPayload) } as never,
			{ exists: vi.fn().mockResolvedValue(false) } as never,
			{ findById: vi.fn().mockResolvedValue(activeUser()) } as never,
			{
				findById: vi
					.fn()
					.mockResolvedValue({ userId: "user-1", isActive: false }),
			} as never,
		);
		const request = { headers: { authorization: "Bearer access" } } as never;
		const reply = replyDouble();

		await middleware(request, reply as never);

		expect(reply.statusCode).toBe(401);
		expect(reply.payload).toMatchObject({ code: "SESSION_REVOKED" });
	});

	it("uses the current account role instead of a stale JWT role", async () => {
		const middleware = createAuthMiddleware(
			{ verifyAccessToken: vi.fn().mockResolvedValue(tokenPayload) } as never,
			{ exists: vi.fn().mockResolvedValue(false) } as never,
			{ findById: vi.fn().mockResolvedValue(activeUser(Role.ADMIN)) } as never,
			{
				findById: vi
					.fn()
					.mockResolvedValue({ userId: "user-1", isActive: true }),
			} as never,
		);
		const request = { headers: { authorization: "Bearer access" } } as {
			headers: { authorization: string };
			user?: typeof tokenPayload;
		};
		const reply = replyDouble();

		await middleware(request as never, reply as never);

		expect(reply.statusCode).toBe(0);
		expect(request.user).toMatchObject({
			role: Role.ADMIN,
			email: "current@example.com",
		});
	});

	it("fails closed when the revocation store is unavailable", async () => {
		const middleware = createAuthMiddleware(
			{ verifyAccessToken: vi.fn().mockResolvedValue(tokenPayload) } as never,
			{
				exists: vi.fn().mockRejectedValue(new Error("redis unavailable")),
			} as never,
			{} as never,
			{} as never,
		);
		const reply = replyDouble();

		await middleware(
			{ headers: { authorization: "Bearer access" } } as never,
			reply as never,
		);

		expect(reply.statusCode).toBe(401);
		expect(reply.payload).toMatchObject({ code: "INVALID_TOKEN" });
	});
});
