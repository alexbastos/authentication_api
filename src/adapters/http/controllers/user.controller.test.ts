import { describe, expect, it, vi } from "vitest";
import { Role } from "../../../domain/entities/role.entity.js";
import { UserController } from "./user.controller.js";

describe("UserController.update", () => {
	it("forwards all generic profile fields but never accepts avatarUrl", async () => {
		const updateExecute = vi.fn().mockResolvedValue({ id: "user-1" });
		const unusedUseCase = { execute: vi.fn() };
		const controller = new UserController(
			unusedUseCase as never,
			{ execute: updateExecute } as never,
			unusedUseCase as never,
			unusedUseCase as never,
			unusedUseCase as never,
			unusedUseCase as never,
			5,
		);
		const send = vi.fn();
		const reply = {
			status: vi.fn().mockReturnValue({ send }),
		};

		await controller.update(
			{
				params: { id: "user-1" },
				user: { sub: "user-1", role: Role.USER },
				body: {
					name: "Updated User",
					phone: "+5511999999999",
					birthDate: "1990-05-20",
					bio: "Updated bio",
					locale: "pt-BR",
					timezone: "America/Sao_Paulo",
					address: { city: "São Paulo" },
				},
			} as never,
			reply as never,
		);

		expect(updateExecute).toHaveBeenCalledWith({
			userId: "user-1",
			name: "Updated User",
			email: undefined,
			password: undefined,
			role: undefined,
			phone: "+5511999999999",
			birthDate: new Date("1990-05-20T00:00:00.000Z"),
			bio: "Updated bio",
			locale: "pt-BR",
			timezone: "America/Sao_Paulo",
			address: { city: "São Paulo" },
			requesterId: "user-1",
			requesterRole: Role.USER,
		});
	});
});
