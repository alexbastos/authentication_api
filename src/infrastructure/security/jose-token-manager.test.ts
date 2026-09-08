import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as jose from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { Role } from "../../domain/entities/role.entity.js";
import { JoseTokenManager } from "./jose-token-manager.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

async function createManager() {
	const directory = await mkdtemp(
		join(tmpdir(), "authentication-api-mfa-token-"),
	);
	temporaryDirectories.push(directory);
	const { privateKey, publicKey } = await jose.generateKeyPair("RS256", {
		extractable: true,
	});
	const privateKeyPath = join(directory, "private.pem");
	const publicKeyPath = join(directory, "public.pem");
	await Promise.all([
		writeFile(privateKeyPath, await jose.exportPKCS8(privateKey)),
		writeFile(publicKeyPath, await jose.exportSPKI(publicKey)),
	]);

	return {
		manager: new JoseTokenManager(
			privateKeyPath,
			publicKeyPath,
			"test-issuer",
			"15m",
		),
		privateKey,
	};
}

describe("JoseTokenManager MFA tokens", () => {
	it("creates a minimal MFA-only token that cannot be verified as an access token", async () => {
		const { manager } = await createManager();
		const token = await manager.generateMfaToken({
			sub: "user-1",
			challengeId: "challenge-1",
			expiresInSeconds: 300,
		});
		const decoded = jose.decodeJwt(token);

		expect(decoded).toMatchObject({
			sub: "user-1",
			challengeId: "challenge-1",
			tokenUse: "mfa",
			aud: "mfa-challenge",
		});
		expect(decoded).not.toHaveProperty("email");
		expect(decoded).not.toHaveProperty("role");
		await expect(manager.verifyAccessToken(token)).rejects.toThrow();
		await expect(manager.verifyMfaToken(token)).resolves.toMatchObject({
			sub: "user-1",
			challengeId: "challenge-1",
			tokenUse: "mfa",
		});
	});

	it("returns the stable expiration error for an expired MFA token", async () => {
		const { manager } = await createManager();
		const token = await manager.generateMfaToken({
			sub: "user-1",
			challengeId: "challenge-1",
			expiresInSeconds: -1,
		});

		await expect(manager.verifyMfaToken(token)).rejects.toMatchObject({
			code: "MFA_TOKEN_EXPIRED",
		});
	});

	it("continues to verify normal access tokens", async () => {
		const { manager } = await createManager();
		const token = await manager.generateAccessToken({
			sub: "user-1",
			email: "user@example.com",
			role: Role.USER,
		});

		await expect(manager.verifyAccessToken(token)).resolves.toMatchObject({
			sub: "user-1",
			tokenUse: "access",
		});
	});

	it("rejects an access token issued for a different audience", async () => {
		const { manager } = await createManager();
		const token = await manager.generateAccessToken({
			sub: "user-1",
			email: "user@example.com",
			role: Role.USER,
			aud: "another-service",
		});

		await expect(manager.verifyAccessToken(token)).rejects.toThrow();
	});

	it("rejects an access token issued by a different issuer", async () => {
		const { manager, privateKey } = await createManager();
		const token = await new jose.SignJWT({
			email: "user@example.com",
			role: Role.USER,
			tokenUse: "access",
			jti: "jti-1",
		})
			.setProtectedHeader({ alg: "RS256" })
			.setSubject("user-1")
			.setIssuedAt()
			.setIssuer("another-issuer")
			.setAudience("authentication-api")
			.setExpirationTime("5m")
			.sign(privateKey);

		await expect(manager.verifyAccessToken(token)).rejects.toThrow();
	});

	it("rejects an access token signed with an unexpected algorithm", async () => {
		const { manager } = await createManager();
		const token = await new jose.SignJWT({
			email: "user@example.com",
			role: Role.USER,
			tokenUse: "access",
			jti: "jti-1",
		})
			.setProtectedHeader({ alg: "HS256" })
			.setSubject("user-1")
			.setIssuedAt()
			.setIssuer("test-issuer")
			.setAudience("authentication-api")
			.setExpirationTime("5m")
			.sign(new TextEncoder().encode("a-test-secret-with-at-least-32-bytes"));

		await expect(manager.verifyAccessToken(token)).rejects.toThrow();
	});
});
