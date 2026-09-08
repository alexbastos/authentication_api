import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ISecureTokenService } from "../../application/ports/secure-token.port.js";

export class SecureTokenService implements ISecureTokenService {
	generate(bytes = 32): string {
		return randomBytes(bytes).toString("base64url");
	}

	digest(value: string): string {
		return createHash("sha256").update(value).digest("hex");
	}

	verifyPkceS256(verifier: string, challenge: string): boolean {
		const actual = Buffer.from(
			createHash("sha256").update(verifier).digest("base64url"),
		);
		const expected = Buffer.from(challenge);
		return (
			actual.length === expected.length && timingSafeEqual(actual, expected)
		);
	}
}
