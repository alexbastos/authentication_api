import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
	normalizeForwardedForHeader,
	resolveClientContext,
} from "./client-context.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp(trustProxy: string[] | false) {
	const app = Fastify({ trustProxy });
	app.get("/context", (request) => {
		normalizeForwardedForHeader(request);
		return resolveClientContext(request);
	});
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

	it("accepts the RFC Forwarded header emitted by AWS HTTP APIs", async () => {
		const app = await createApp(["10.0.0.0/8"]);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "10.0.0.10",
			headers: {
				forwarded:
					"for=200.160.2.3;host=example.execute-api.us-east-1.amazonaws.com;proto=https",
				"user-agent": "Client Browser",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "200.160.2.3",
			userAgent: "Client Browser",
		});
	});

	it("resolves the client through every allowlisted proxy in a Forwarded chain", async () => {
		const app = await createApp(["10.0.0.0/8", "3.235.32.97/32"]);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "10.0.0.10",
			headers: {
				forwarded: "for=200.160.2.3;proto=https, for=3.235.32.97;proto=http",
				"user-agent": "Client Browser",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "200.160.2.3",
			userAgent: "Client Browser",
		});
	});

	it("does not trust Forwarded when the socket peer is not allowlisted", async () => {
		const app = await createApp(["10.0.0.0/8"]);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "198.51.100.20",
			headers: {
				forwarded: "for=200.160.2.3;proto=https",
				"user-agent": "Direct Client",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "198.51.100.20",
			userAgent: "Direct Client",
		});
	});

	it("rejects an incomplete Forwarded chain instead of skipping its invalid hop", async () => {
		const app = await createApp(["10.0.0.0/8"]);
		const response = await app.inject({
			method: "GET",
			url: "/context",
			remoteAddress: "10.0.0.10",
			headers: {
				forwarded: "for=200.160.2.3, for=unknown",
				"user-agent": "Client Browser",
			},
		});

		expect(response.json()).toEqual({
			ipAddress: "10.0.0.10",
			userAgent: "Client Browser",
		});
	});
});
