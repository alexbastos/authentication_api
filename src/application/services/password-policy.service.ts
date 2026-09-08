import { WeakPasswordError } from "../../domain/errors/domain-errors.js";

const MAX_BCRYPT_INPUT_BYTES = 72;

export function assertStrongPassword(password: string): void {
	const errors: string[] = [];
	if (password.length < 8) errors.push("at least 8 characters");
	if (new TextEncoder().encode(password).byteLength > MAX_BCRYPT_INPUT_BYTES) {
		errors.push(`at most ${MAX_BCRYPT_INPUT_BYTES} UTF-8 bytes`);
	}
	if (!/[A-Z]/.test(password)) errors.push("at least one uppercase letter");
	if (!/[a-z]/.test(password)) errors.push("at least one lowercase letter");
	if (!/[0-9]/.test(password)) errors.push("at least one digit");
	if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
		errors.push("at least one special character");
	}
	if (errors.length > 0) throw new WeakPasswordError(errors.join(", "));
}
