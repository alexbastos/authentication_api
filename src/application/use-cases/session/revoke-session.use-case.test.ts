import { describe, expect, it, vi } from "vitest";
import { RevokeSessionUseCase } from "./revoke-session.use-case.js";

describe("RevokeSessionUseCase", () => {
	it("delegates ownership-safe atomic revocation to the security repository", async () => {
		const revokeSessionAndTokens = vi.fn().mockResolvedValue(undefined);
		const useCase = new RevokeSessionUseCase({
			revokeSessionAndTokens,
		} as never);

		await useCase.execute({ userId: "user-1", sessionId: "session-1" });

		expect(revokeSessionAndTokens).toHaveBeenCalledWith("user-1", "session-1");
	});
});
