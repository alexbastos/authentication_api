import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp(options?: {
	databaseFails?: boolean;
	redisFails?: boolean;
}) {
	const unusedController = new Proxy({}, { get: () => vi.fn() });
	const databaseCheck = options?.databaseFails
		? vi.fn().mockRejectedValue(new Error("database unavailable"))
		: vi.fn().mockResolvedValue([{ value: 1 }]);
	const redisCheck = options?.redisFails
		? vi.fn().mockRejectedValue(new Error("redis unavailable"))
		: vi
				.fn()
				.mockRejectedValueOnce(new Error("skip Redis rate-limit store in test"))
				.mockResolvedValue("PONG");

	const app = await buildApp(
		{
			LOG_LEVEL: "fatal",
			NODE_ENV: "test",
			CORS_ORIGIN: "*",
			RATE_LIMIT_MAX: 100,
			RATE_LIMIT_WINDOW_MS: 60_000,
			AVATAR_MAX_SIZE_MB: 5,
		} as never,
		{
			prisma: { $queryRaw: databaseCheck },
			redis: { getClient: () => ({ ping: redisCheck }) },
			authController: unusedController,
			userController: unusedController,
			clientAppController: unusedController,
			sessionController: unusedController,
			organizationController: unusedController,
			rbacController: unusedController,
			webhookController: unusedController,
			oauthController: unusedController,
			mfaController: unusedController,
			authMiddleware: vi.fn(),
			oauthAuthMiddleware: vi.fn(),
			orgRepository: unusedController,
		} as never,
	);
	await app.ready();
	apps.push(app);
	return { app, databaseCheck, redisCheck };
}

describe("health readiness endpoint", () => {
	it("returns healthy only after checking PostgreSQL and Redis", async () => {
		const { app, databaseCheck, redisCheck } = await createApp();

		const response = await app.inject({
			method: "GET",
			url: "/health/authentication_api",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ status: "ok" });
		expect(databaseCheck).toHaveBeenCalledOnce();
		expect(redisCheck).toHaveBeenCalledTimes(2);
	});

	it("returns unavailable when a critical dependency fails", async () => {
		const { app } = await createApp({ redisFails: true });

		const response = await app.inject({
			method: "GET",
			url: "/health/authentication_api",
		});

		expect(response.statusCode).toBe(503);
		expect(response.json()).toMatchObject({ status: "unavailable" });
	});
});
