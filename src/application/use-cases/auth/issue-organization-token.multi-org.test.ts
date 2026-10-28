import { describe, expect, it, vi } from "vitest";
import { Role } from "../../../domain/entities/role.entity.js";
import { IssueOrganizationTokenUseCase } from "./issue-organization-token.use-case.js";

describe("IssueOrganizationTokenUseCase multi-organization access", () => {
	it("issues separate organization-scoped sessions for the same user", async () => {
		const sessions: Array<{ id: string; family: string; userId: string }> = [];
		const refreshTokens: Array<{
			organizationId: string | null;
			userId: string;
		}> = [];
		const claims: Array<{ sub: string; organizationId?: string }> = [];
		let refreshCounter = 0;
		const useCase = new IssueOrganizationTokenUseCase(
			{
				findById: vi.fn(async (id: string) => ({ id, isActive: true })),
				findMember: vi.fn().mockResolvedValue({ userId: "multi-org-user" }),
			} as never,
			{
				create: vi.fn(
					async (token: { organizationId: string | null; userId: string }) => {
						refreshTokens.push(token);
					},
				),
			} as never,
			{
				create: vi.fn(
					async (session: { id: string; family: string; userId: string }) => {
						sessions.push(session);
					},
				),
			} as never,
			{
				generateRefreshToken: vi.fn(
					() => `organization-refresh-${++refreshCounter}`,
				),
				generateAccessToken: vi.fn(
					async (payload: { sub: string; organizationId?: string }) => {
						claims.push(payload);
						return `organization-access-${claims.length}`;
					},
				),
			} as never,
			{ lookup: vi.fn().mockReturnValue(null) } as never,
			{ digest: vi.fn((value: string) => `digest:${value}`) } as never,
			"vetorthoplan-api",
			7,
			900,
		);

		const first = await useCase.execute({
			userId: "multi-org-user",
			email: "multi-org@example.com",
			role: Role.USER,
			organizationId: "org-vet",
			userAgent: "VetOrthoPlan",
		});
		const second = await useCase.execute({
			userId: "multi-org-user",
			email: "multi-org@example.com",
			role: Role.USER,
			organizationId: "org-capta-clinic",
			userAgent: "CaptaGov",
		});

		expect(first.organizationId).toBe("org-vet");
		expect(second.organizationId).toBe("org-capta-clinic");
		expect(first.accessToken).not.toBe(second.accessToken);
		expect(sessions).toHaveLength(2);
		expect(sessions[0].family).not.toBe(sessions[1].family);
		expect(claims.map((claim) => claim.organizationId)).toEqual([
			"org-vet",
			"org-capta-clinic",
		]);
		expect(refreshTokens.map((token) => token.organizationId)).toEqual([
			"org-vet",
			"org-capta-clinic",
		]);
	});
});
