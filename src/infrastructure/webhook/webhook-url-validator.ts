import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { IWebhookUrlValidator } from "../../application/ports/webhook-url-validator.port.js";
import { InvalidWebhookUrlError } from "../../domain/errors/domain-errors.js";

function isPublicIpv4(address: string): boolean {
	const octets = address.split(".").map(Number);
	if (
		octets.length !== 4 ||
		octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
	) {
		return false;
	}

	const [a, b] = octets;
	return !(
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51) ||
		(a === 203 && b === 0) ||
		a >= 224
	);
}

function isPublicIpv6(address: string): boolean {
	const normalized = address.toLowerCase().split("%")[0];
	const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
	if (mappedIpv4) return isPublicIpv4(mappedIpv4);

	return !(
		normalized === "::" ||
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		/^fe[89ab]/.test(normalized) ||
		normalized.startsWith("ff") ||
		normalized.startsWith("2001:db8:")
	);
}

export function isPublicNetworkAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return isPublicIpv4(address);
	if (family === 6) return isPublicIpv6(address);
	return false;
}

export class SecureWebhookUrlValidator implements IWebhookUrlValidator {
	async assertAllowed(value: string): Promise<void> {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new InvalidWebhookUrlError();
		}

		if (url.protocol !== "https:" || url.username || url.password) {
			throw new InvalidWebhookUrlError();
		}

		const hostname = url.hostname.toLowerCase();
		if (
			hostname === "localhost" ||
			hostname.endsWith(".localhost") ||
			hostname.endsWith(".local")
		) {
			throw new InvalidWebhookUrlError();
		}

		if (isIP(hostname)) {
			if (!isPublicNetworkAddress(hostname)) throw new InvalidWebhookUrlError();
			return;
		}

		let addresses: Array<{ address: string; family: number }>;
		try {
			addresses = await lookup(hostname, { all: true, verbatim: true });
		} catch {
			throw new InvalidWebhookUrlError();
		}

		if (
			addresses.length === 0 ||
			addresses.some(({ address }) => !isPublicNetworkAddress(address))
		) {
			throw new InvalidWebhookUrlError();
		}
	}
}
