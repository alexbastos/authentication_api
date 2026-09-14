import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { resolveClientContext } from "./client-context.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp(trustProxy: string[] | false) {
	const app = Fastify({ trustProxy });
	app.get("/context", (request) => resolveClientContext(request));
	await app.ready();
	apps.push(app);
	return app;
}

describe("forwarded client context", () => {
	it("accepts the original IP and User-Agent from an allowlisted BFF", async () => {
		const app = await createApp(["10.0.0.0/8"]);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "10.0.0.10",
			headers: {
				"x-forwarded-for": "200.160.2.3",
				"x-original-user-agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0",
				"user-agent": "node",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "200.160.2.3",
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0",
		});
	});

	it("ignores spoofed forwarding headers from a direct client", async () => {
		const app = await createApp(["10.0.0.0/8"]);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "198.51.100.20",
			headers: {
				"x-forwarded-for": "200.160.2.3",
				"x-original-user-agent": "Spoofed Browser",
				"user-agent": "Direct Client",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "198.51.100.20",
			userAgent: "Direct Client",
		});
	});

	it("ignores all forwarding headers when proxy support is disabled", async () => {
		const app = await createApp(false);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "198.51.100.20",
			headers: {
				"x-forwarded-for": "200.160.2.3",
				"x-original-user-agent": "Spoofed Browser",
				"user-agent": "Direct Client",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "198.51.100.20",
			userAgent: "Direct Client",
		});
	});
});
