import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { IDataProtector } from "../../application/ports/data-protector.port.js";

const PREFIX = "enc:v1:";

export class AesGcmDataProtector implements IDataProtector {
	private readonly key: Buffer;

	constructor(hexKey: string) {
		this.key = Buffer.from(hexKey, "hex");
		if (this.key.length !== 32)
			throw new Error(
				"DATA_ENCRYPTION_KEY must contain exactly 32 bytes as 64 hex characters",
			);
	}

	isProtected(value: string): boolean {
		return value.startsWith(PREFIX);
	}

	protect(plaintext: string): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv);
		const ciphertext = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);
		return `${PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
	}

	unprotect(value: string): string {
		if (!this.isProtected(value)) return value;
		const [iv, tag, ciphertext] = value.slice(PREFIX.length).split(".");
		if (!iv || !tag || ciphertext === undefined)
			throw new Error("Invalid protected data envelope");
		const decipher = createDecipheriv(
			"aes-256-gcm",
			this.key,
			Buffer.from(iv, "base64url"),
		);
		decipher.setAuthTag(Buffer.from(tag, "base64url"));
		return Buffer.concat([
			decipher.update(Buffer.from(ciphertext, "base64url")),
			decipher.final(),
		]).toString("utf8");
	}
}
