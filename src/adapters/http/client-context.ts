import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";

export const FORWARDED_USER_AGENT_HEADER = "x-original-user-agent";

export interface ClientContext {
	userAgent: string | undefined;
	ipAddress: string;
}

/**
 * AWS API Gateway HTTP APIs convert X-Forwarded-* into the RFC 7239
 * Forwarded header before calling an HTTP integration. Fastify only reads
 * X-Forwarded-For when resolving request.ip, so expose the validated `for`
 * chain in the format Fastify understands.
 *
 * This does not make an untrusted Forwarded header authoritative: Fastify's
 * trustProxy predicate still checks the socket peer before using this chain.
 */
export function normalizeForwardedForHeader(request: FastifyRequest): void {
	if (request.raw.headers["x-forwarded-for"]) return;

	const forwardedFor = parseForwardedFor(request.raw.headers.forwarded);
	if (forwardedFor) {
		request.raw.headers["x-forwarded-for"] = forwardedFor.join(", ");
	}
}

/**
 * Resolves the browser context without allowing a direct client to spoof it.
 * Fastify adds forwarded hops to request.ips only after its trustProxy
 * allowlist accepts the socket peer. Without an accepted proxy hop, both
 * forwarded headers are ignored.
 */
export function resolveClientContext(request: FastifyRequest): ClientContext {
	const hasTrustedForwardedHop = (request.ips?.length ?? 0) > 1;
	const forwardedUserAgent = request.headers[FORWARDED_USER_AGENT_HEADER];
	const originalUserAgent = Array.isArray(forwardedUserAgent)
		? forwardedUserAgent[0]
		: forwardedUserAgent;
	const directUserAgent = request.headers["user-agent"];
	const userAgent = hasTrustedForwardedHop
		? (normalizeUserAgent(originalUserAgent) ??
			normalizeUserAgent(directUserAgent))
		: normalizeUserAgent(directUserAgent);

	return {
		userAgent,
		ipAddress: request.ip,
	};
}

function normalizeUserAgent(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	if (!normalized) return undefined;
	return normalized.slice(0, 500);
}

function parseForwardedFor(
	header: string | string[] | undefined,
): string[] | undefined {
	if (!header) return undefined;

	const elements = splitOutsideQuotes(
		Array.isArray(header) ? header.join(",") : header,
		",",
	);
	const addresses: string[] = [];

	for (const element of elements) {
		const parameters = splitOutsideQuotes(element, ";");
		const forParameter = parameters.find((parameter) => {
			const separator = parameter.indexOf("=");
			return (
				separator > 0 &&
				parameter.slice(0, separator).trim().toLowerCase() === "for"
			);
		});

		if (!forParameter) return undefined;

		const address = normalizeForwardedAddress(
			forParameter.slice(forParameter.indexOf("=") + 1),
		);
		// Fail closed instead of skipping an invalid hop and accidentally
		// treating an address to its left as authoritative.
		if (!address) return undefined;
		addresses.push(address);
	}

	return addresses.length > 0 ? addresses : undefined;
}

function normalizeForwardedAddress(value: string): string | undefined {
	let address = value.trim();
	if (address.startsWith('"')) {
		if (!address.endsWith('"') || address.length < 2) return undefined;
		address = address.slice(1, -1).replace(/\\(.)/g, "$1");
	}

	if (
		!address ||
		address.toLowerCase() === "unknown" ||
		address.startsWith("_")
	) {
		return undefined;
	}

	if (address.startsWith("[")) {
		const closingBracket = address.indexOf("]");
		if (closingBracket < 0) return undefined;
		const host = address.slice(1, closingBracket);
		const suffix = address.slice(closingBracket + 1);
		if (suffix && !/^:\d+$/.test(suffix)) return undefined;
		return isIP(host) === 6 ? host : undefined;
	}

	if (isIP(address)) return address;

	const ipv4WithPort = address.match(/^(.+):(\d+)$/);
	if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1]) === 4) {
		return ipv4WithPort[1];
	}

	return undefined;
}

function splitOutsideQuotes(value: string, separator: "," | ";"): string[] {
	const parts: string[] = [];
	let start = 0;
	let quoted = false;
	let escaped = false;

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (quoted && character === "\\") {
			escaped = true;
			continue;
		}
		if (character === '"') {
			quoted = !quoted;
			continue;
		}
		if (!quoted && character === separator) {
			parts.push(value.slice(start, index).trim());
			start = index + 1;
		}
	}

	if (quoted || escaped) return [];
	parts.push(value.slice(start).trim());
	return parts.filter(Boolean);
}
