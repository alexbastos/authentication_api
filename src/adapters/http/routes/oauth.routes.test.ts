import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerOAuthRoutes } from "./oauth.routes.js";

const apps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp() {
	const app = Fastify({ logger: false });
	apps.push(app);
	const internalAuth = vi.fn(async () => undefined);
	const oauthUserInfoAuth = vi.fn(async () => undefined);
	const controller = {
		authorize: vi.fn(),
		grantConsent: vi.fn(async (_request, reply) =>
			reply.status(200).send({ message: "Consent granted" }),
		),
		token: vi.fn(),
		userinfo: vi.fn(async (_request, reply) =>
			reply.status(200).send({ sub: "user-1" }),
		),
	};

	registerOAuthRoutes(
		app,
		controller as never,
		internalAuth,
		oauthUserInfoAuth,
	);
	await app.ready();

	return { app, internalAuth, oauthUserInfoAuth };
}

describe("OAuth route authentication boundaries", () => {
	it("uses the internal session middleware for consent", async () => {
		const { app, internalAuth, oauthUserInfoAuth } = await createApp();

		const response = await app.inject({
			method: "POST",
			url: "/oauth/consent",
			payload: { client_id: "client-1", scopes: ["openid"] },
		});

		expect(response.statusCode).toBe(200);
		expect(internalAuth).toHaveBeenCalledOnce();
		expect(oauthUserInfoAuth).not.toHaveBeenCalled();
	});

	it("uses the OAuth audience middleware for UserInfo", async () => {
		const { app, internalAuth, oauthUserInfoAuth } = await createApp();

		const response = await app.inject({
			method: "GET",
			url: "/oauth/userinfo",
		});

		expect(response.statusCode).toBe(200);
		expect(oauthUserInfoAuth).toHaveBeenCalledOnce();
		expect(internalAuth).not.toHaveBeenCalled();
	});
});
