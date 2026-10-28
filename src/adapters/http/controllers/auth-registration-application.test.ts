import { describe, expect, it, vi } from "vitest";
import { AuthController } from "./auth.controller.js";

function createController(authAppUrls: Record<string, string>) {
	const register = vi.fn().mockResolvedValue({ id: "user-1" });
	const resend = vi.fn().mockResolvedValue({
		message: "If the account exists, a verification email was sent",
	});
	const passwordReset = vi.fn().mockResolvedValue({
		message: "If the account exists, a reset email was sent",
	});
	const controller = new AuthController(
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{ execute: register } as never,
		{} as never,
		{} as never,
		{ execute: resend } as never,
		{ execute: passwordReset } as never,
		{} as never,
		{} as never,
		"https://default.example",
		24,
		1,
		undefined,
		authAppUrls,
	);
	return { controller, register, resend, passwordReset };
}

function createReply() {
	const reply = {
		status: vi.fn(),
		send: vi.fn(),
	};
	reply.status.mockReturnValue(reply);
	reply.send.mockReturnValue(reply);
	return reply;
}

describe("registration verification application", () => {
	it("uses the allowlisted verification URL for the selected application", async () => {
		const { controller, register } = createController({
			vetorthoplan: "https://vet.example/",
		});
		const reply = createReply();

		await controller.register(
			{
				body: {
					name: "Synthetic user",
					email: "user@example.com",
					password: "StrongPassword123!",
					applicationId: "vetorthoplan",
				},
			} as never,
			reply as never,
		);

		expect(register).toHaveBeenCalledWith(
			expect.objectContaining({ appUrl: "https://vet.example/" }),
		);
		expect(reply.status).toHaveBeenCalledWith(201);
	});

	it("preserves the legacy default URL when applicationId is omitted", async () => {
		const { controller, register } = createController({
			vetorthoplan: "https://vet.example",
		});
		const reply = createReply();

		await controller.register(
			{
				body: {
					name: "Synthetic user",
					email: "user@example.com",
					password: "StrongPassword123!",
				},
			} as never,
			reply as never,
		);

		expect(register).toHaveBeenCalledWith(
			expect.objectContaining({ appUrl: "https://default.example" }),
		);
	});

	it("does not silently send an unconfigured application to another product URL", async () => {
		const { controller, register } = createController({
			vetorthoplan: "https://vet.example",
		});
		const reply = createReply();

		await controller.register(
			{
				body: {
					name: "Synthetic user",
					email: "user@example.com",
					password: "StrongPassword123!",
					applicationId: "captagov",
				},
			} as never,
			reply as never,
		);

		expect(register).not.toHaveBeenCalled();
		expect(reply.status).toHaveBeenCalledWith(400);
		expect(reply.send).toHaveBeenCalledWith(
			expect.objectContaining({
				code: "AUTH_APP_URL_UNCONFIGURED",
			}),
		);
	});

	it("routes resend and password recovery emails to the requesting application", async () => {
		const { controller, resend, passwordReset } = createController({
			vetorthoplan: "https://vet.example",
			captagov: "https://capta.example",
		});
		const reply = createReply();

		await controller.resendVerification(
			{
				body: { email: "user@example.com", applicationId: "vetorthoplan" },
			} as never,
			reply as never,
		);
		await controller.forgotPassword(
			{
				body: { email: "user@example.com", applicationId: "captagov" },
			} as never,
			reply as never,
		);

		expect(resend).toHaveBeenCalledWith(
			expect.objectContaining({ appUrl: "https://vet.example" }),
		);
		expect(passwordReset).toHaveBeenCalledWith(
			expect.objectContaining({ appUrl: "https://capta.example" }),
		);
	});
});
