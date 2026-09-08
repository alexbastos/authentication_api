import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../app.js";

interface OpenApiOperation {
	description?: string;
	requestBody?: {
		content: Record<string, { schema: Record<string, unknown> }>;
	};
	responses: Record<
		string,
		{
			content?: Record<string, { schema: Record<string, unknown> }>;
		}
	>;
}

interface MfaOpenApiDocument {
	paths: Record<
		string,
		{
			get?: OpenApiOperation;
			post?: OpenApiOperation;
		}
	>;
}

let app: FastifyInstance;
let loginResult: Record<string, unknown>;

function getOperation(
	document: MfaOpenApiDocument,
	path: string,
	method: "get" | "post",
): OpenApiOperation {
	const operation = document.paths[path]?.[method];
	expect(operation).toBeDefined();
	if (!operation)
		throw new Error(
			`Missing OpenAPI operation ${method.toUpperCase()} ${path}`,
		);
	return operation;
}

function getJsonResponseSchema(
	operation: OpenApiOperation,
	status: string,
): Record<string, unknown> {
	const schema =
		operation.responses[status]?.content?.["application/json"]?.schema;
	expect(schema).toBeDefined();
	if (!schema)
		throw new Error(`Missing application/json schema for response ${status}`);
	return schema;
}

beforeAll(async () => {
	const unusedController = new Proxy({}, { get: () => vi.fn() });
	const login = vi.fn(async (_request, reply) =>
		reply.status(200).send(loginResult),
	);
	const authController = new Proxy(
		{ login },
		{
			get: (target, property) =>
				property in target ? Reflect.get(target, property) : vi.fn(),
		},
	);
	loginResult = {
		type: "mfa_required",
		mfaToken: "temporary-mfa-token",
		availableMethods: ["TOTP", "EMAIL", "RECOVERY"],
	};

	app = await buildApp(
		{
			LOG_LEVEL: "fatal",
			NODE_ENV: "test",
			CORS_ORIGIN: "*",
			RATE_LIMIT_MAX: 100,
			RATE_LIMIT_WINDOW_MS: 60_000,
			AVATAR_MAX_SIZE_MB: 5,
		} as never,
		{
			redis: {
				getClient: () => ({
					ping: async () => {
						throw new Error("Redis intentionally disabled in contract tests");
					},
				}),
			},
			authController,
			userController: unusedController,
			clientAppController: unusedController,
			sessionController: unusedController,
			organizationController: unusedController,
			rbacController: unusedController,
			webhookController: unusedController,
			oauthController: unusedController,
			mfaController: unusedController,
			authMiddleware: vi.fn(),
			orgRepository: unusedController,
		} as never,
	);
	await app.ready();
});

afterAll(async () => {
	await app.close();
});

describe("MFA OpenAPI contract", () => {
	it("models login as a discriminated oneOf returned with HTTP 200", () => {
		const document = app.swagger() as unknown as MfaOpenApiDocument;
		const login = getOperation(
			document,
			"/authentication_api/api/v1/auth/login",
			"post",
		);
		const schema = getJsonResponseSchema(login, "200") as {
			oneOf: Array<{ required: string[]; properties: Record<string, unknown> }>;
			discriminator: { propertyName: string };
		};

		expect(schema.discriminator).toEqual({ propertyName: "type" });
		expect(schema.oneOf).toHaveLength(2);
		expect(schema.oneOf[0].required).toContain("accessToken");
		expect(schema.oneOf[1].required).toEqual([
			"type",
			"mfaToken",
			"availableMethods",
		]);
		expect(login.responses).not.toHaveProperty("202");
	});

	it("serializes the MFA challenge without session tokens", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/authentication_api/api/v1/auth/login",
			payload: { email: "mfa@example.com", password: "SecurePassword123!" },
		});

		expect(response.statusCode, response.body).toBe(200);
		expect(response.json()).toEqual({
			type: "mfa_required",
			mfaToken: "temporary-mfa-token",
			availableMethods: ["TOTP", "EMAIL", "RECOVERY"],
		});
		expect(response.json()).not.toHaveProperty("accessToken");
		expect(response.json()).not.toHaveProperty("refreshToken");
	});

	it("serializes the authenticated variant after login completes", async () => {
		loginResult = {
			type: "authenticated",
			accessToken: "access-token",
			refreshToken: "refresh-token",
			user: {
				id: "user-1",
				name: "User",
				email: "user@example.com",
				role: "USER",
				emailVerified: true,
			},
		};

		const response = await app.inject({
			method: "POST",
			url: "/authentication_api/api/v1/auth/login",
			payload: { email: "user@example.com", password: "SecurePassword123!" },
		});

		expect(response.statusCode, response.body).toBe(200);
		expect(response.json()).toMatchObject({
			type: "authenticated",
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
	});

	it("documents 401 for every Bearer-protected MFA endpoint", () => {
		const document = app.swagger() as unknown as MfaOpenApiDocument;
		const protectedOperations = [
			getOperation(
				document,
				"/authentication_api/api/v1/auth/mfa/setup",
				"post",
			),
			getOperation(
				document,
				"/authentication_api/api/v1/auth/mfa/verify-setup",
				"post",
			),
			getOperation(
				document,
				"/authentication_api/api/v1/auth/mfa/disable",
				"post",
			),
			getOperation(
				document,
				"/authentication_api/api/v1/auth/mfa/status",
				"get",
			),
			getOperation(
				document,
				"/authentication_api/api/v1/auth/mfa/recovery-codes/regenerate",
				"post",
			),
		];

		for (const operation of protectedOperations) {
			expect(operation.responses).toHaveProperty("401");
		}
	});

	it("documents exact TOTP setup and recovery code guarantees", () => {
		const document = app.swagger() as unknown as MfaOpenApiDocument;
		const setup = getOperation(
			document,
			"/authentication_api/api/v1/auth/mfa/setup",
			"post",
		);
		const setupSchema = getJsonResponseSchema(setup, "200") as {
			oneOf: Array<{ required: string[] }>;
		};
		const verifySetup = getOperation(
			document,
			"/authentication_api/api/v1/auth/mfa/verify-setup",
			"post",
		);
		const verifySchema = getJsonResponseSchema(verifySetup, "200") as {
			properties: {
				recoveryCodes: {
					minItems: number;
					maxItems: number;
					items: { pattern: string };
				};
			};
		};

		expect(setupSchema.oneOf[0].required).toEqual([
			"method",
			"qrCodeUrl",
			"secret",
			"message",
		]);
		expect(verifySchema.properties.recoveryCodes).toMatchObject({
			minItems: 10,
			maxItems: 10,
			items: { pattern: "^[0-9A-F]{8}-[0-9A-F]{8}$" },
		});
	});
});
