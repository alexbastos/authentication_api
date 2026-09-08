import type { Prisma, PrismaClient } from "@prisma/client";
import type { IAccountSecurityRepository } from "../../../application/ports/account-security.port.js";

export class PrismaAccountSecurityRepository
	implements IAccountSecurityRepository
{
	constructor(private readonly prisma: PrismaClient) {}

	async verifyEmailWithToken(
		tokenId: string,
		userId: string,
	): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const consumedAt = new Date();
			const consumed = await tx.verificationToken.updateMany({
				where: {
					id: tokenId,
					userId,
					type: "EMAIL_VERIFICATION",
					usedAt: null,
					expiresAt: { gt: consumedAt },
				},
				data: { usedAt: consumedAt },
			});
			if (consumed.count !== 1) return false;

			await tx.verificationToken.updateMany({
				where: {
					userId,
					type: "EMAIL_VERIFICATION",
					usedAt: null,
				},
				data: { usedAt: consumedAt },
			});
			await tx.user.update({
				where: { id: userId },
				data: { emailVerified: true },
			});
			return true;
		});
	}

	async resetPasswordAndRevokeSessions(input: {
		verificationTokenId: string;
		userId: string;
		passwordHash: string;
	}): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const consumed = await tx.verificationToken.updateMany({
				where: {
					id: input.verificationTokenId,
					userId: input.userId,
					type: "PASSWORD_RESET",
					usedAt: null,
					expiresAt: { gt: new Date() },
				},
				data: { usedAt: new Date() },
			});
			if (consumed.count !== 1) return false;

			await tx.verificationToken.updateMany({
				where: {
					userId: input.userId,
					type: "PASSWORD_RESET",
					usedAt: null,
				},
				data: { usedAt: new Date() },
			});

			await tx.user.update({
				where: { id: input.userId },
				data: { passwordHash: input.passwordHash },
			});
			await this.revokeSessions(tx, input.userId);
			return true;
		});
	}

	async changePasswordAndRevokeSessions(
		userId: string,
		passwordHash: string,
	): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({ where: { id: userId }, data: { passwordHash } });
			await this.revokeSessions(tx, userId);
		});
	}

	async deactivateUserAndRevokeSessions(userId: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: { status: "INACTIVE" },
			});
			await this.revokeSessions(tx, userId);
		});
	}

	async revokeSessionAndTokens(
		userId: string,
		sessionId: string,
	): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const session = await tx.session.findFirst({
				where: { id: sessionId, userId },
				select: { family: true },
			});
			if (!session) return;

			const revokedAt = new Date();
			await tx.session.updateMany({
				where: { id: sessionId, userId, revokedAt: null },
				data: { revokedAt },
			});
			await tx.refreshToken.updateMany({
				where: { family: session.family, userId, revokedAt: null },
				data: { revokedAt },
			});
		});
	}

	private async revokeSessions(
		tx: Prisma.TransactionClient,
		userId: string,
	): Promise<void> {
		const revokedAt = new Date();
		await tx.refreshToken.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt },
		});
		await tx.session.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt },
		});
	}
}
