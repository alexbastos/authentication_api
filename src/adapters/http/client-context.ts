import type { FastifyRequest } from "fastify";

export const FORWARDED_USER_AGENT_HEADER = "x-original-user-agent";

export interface ClientContext {
	userAgent: string | undefined;
	ipAddress: string;
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
