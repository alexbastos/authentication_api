import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../app.js";
import { Role } from "../../../domain/entities/role.entity.js";
import { UserController } from "../controllers/user.controller.js";

const apps: FastifyInstance[] = [];

interface ContractRequestBody {
	required?: boolean;
	content: Record<
		string,
		{
			schema: {
				required?: string[];
				properties: Record<string, Record<string, unknown>>;
			};
		}
	>;
}

interface ContractOpenApiDocument {
	paths: {
		"/authentication_api/api/v1/users/me/avatar": {
			post: { requestBody: ContractRequestBody };
		};
		"/authentication_api/api/v1/users/{id}": {
			put: { requestBody: ContractRequestBody };
		};
	};
}

afterEach(async () => {
	await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp(uploadExecute = vi.fn(), avatarMaxSizeMB = 5) {
	const unusedUseCase = { execute: vi.fn() };
	const userController = new UserController(
		unusedUseCase as never,
		unusedUseCase as never,
		unusedUseCase as never,
		unusedUseCase as never,
		{ execute: uploadExecute } as never,
		unusedUseCase as never,
		avatarMaxSizeMB,
	);
	const unusedController = new Proxy(
		{},
		{
			get: () => vi.fn(),
		},
	);
	const authMiddleware = async (request: { user?: unknown }) => {
		request.user = { sub: "user-1", role: Role.USER };
	};

	const app = await buildApp(
		{
			LOG_LEVEL: "fatal",
			NODE_ENV: "test",
			CORS_ORIGIN: "*",
			RATE_LIMIT_MAX: 100,
			RATE_LIMIT_WINDOW_MS: 60_000,
			AVATAR_MAX_SIZE_MB: avatarMaxSizeMB,
		} as never,
		{
			redis: {
				getClient: () => ({
					ping: async () => {
						throw new Error("Redis intentionally disabled in contract tests");
					},
				}),
			},
			userController,
			authMiddleware,
			authController: unusedController,
			clientAppController: unusedController,
			sessionController: unusedController,
			organizationController: unusedController,
			rbacController: unusedController,
			webhookController: unusedController,
			oauthController: unusedController,
			mfaController: unusedController,
			orgRepository: unusedController,
		} as never,
	);

	await app.ready();
	apps.push(app);
	return app;
}

describe("avatar OpenAPI contract", () => {
	it("declares the required multipart avatar request body", async () => {
		const app = await createApp();
		const document = app.swagger() as unknown as ContractOpenApiDocument;
		const post =
			document.paths["/authentication_api/api/v1/users/me/avatar"].post;
		const requestBody = post.requestBody;
		const schema = requestBody.content["multipart/form-data"].schema;

		expect(requestBody.required).toBe(true);
		expect(schema.required).toEqual(["avatar"]);
		expect(schema.properties.avatar).toMatchObject({
			type: "string",
			format: "binary",
		});
	});

	it("does not expose avatarUrl in the generic user update request", async () => {
		const app = await createApp();
		const document = app.swagger() as unknown as ContractOpenApiDocument;
		const put = document.paths["/authentication_api/api/v1/users/{id}"].put;
		const schema = put.requestBody.content["application/json"].schema;

		expect(schema.properties).not.toHaveProperty("avatarUrl");
	});

	it("accepts the avatar field and returns the frontend response shape", async () => {
		const uploadExecute = vi.fn().mockResolvedValue({
			avatarUrl: "https://storage.example/avatar.png?signature=fresh",
			message: "Avatar uploaded successfully",
		});
		const app = await createApp(uploadExecute);
		const form = new FormData();
		form.append(
			"avatar",
			new Blob(
				[Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
				{ type: "image/png" },
			),
			"avatar.png",
		);

		const response = await app.inject({
			method: "POST",
			url: "/authentication_api/api/v1/users/me/avatar",
			payload: form,
		});

		expect(response.statusCode, response.body).toBe(200);
		expect(response.json()).toEqual({
			avatarUrl: "https://storage.example/avatar.png?signature=fresh",
			message: "Avatar uploaded successfully",
		});
		expect(uploadExecute).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				mimeType: "image/png",
				maxSizeMB: 5,
			}),
		);
	});

	it("rejects a multipart file sent under a different field name", async () => {
		const uploadExecute = vi.fn();
		const app = await createApp(uploadExecute);
		const form = new FormData();
		form.append(
			"file",
			new Blob(["not-an-avatar"], { type: "image/png" }),
			"avatar.png",
		);

		const response = await app.inject({
			method: "POST",
			url: "/authentication_api/api/v1/users/me/avatar",
			payload: form,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json().code).toBe("VALIDATION_ERROR");
		expect(uploadExecute).not.toHaveBeenCalled();
	});

	it("returns the documented error when the multipart parser rejects an oversized file", async () => {
		const uploadExecute = vi.fn();
		const app = await createApp(uploadExecute, 0.000001);
		const form = new FormData();
		form.append(
			"avatar",
			new Blob(["too large"], { type: "image/png" }),
			"avatar.png",
		);

		const response = await app.inject({
			method: "POST",
			url: "/authentication_api/api/v1/users/me/avatar",
			payload: form,
		});

		expect(response.statusCode).toBe(400);
		expect(response.json().code).toBe("FILE_TOO_LARGE");
		expect(uploadExecute).not.toHaveBeenCalled();
	});
});
