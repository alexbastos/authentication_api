export function parseDeviceName(
	userAgent: string | null | undefined,
): string | null {
	if (!userAgent) return null;

	const browser = parseBrowser(userAgent);
	const os = parseOS(userAgent);
	if (!browser && !os) return null;
	if (!browser) return os;
	if (!os) return browser;
	return `${browser} - ${os}`;
}

function parseBrowser(userAgent: string): string | null {
	const patterns: Array<[RegExp, string]> = [
		[/Edg(?:e)?\/(\d+)/, "Edge"],
		[/OPR\/(\d+)/, "Opera"],
		[/(?:Chromium|CriOS)\/(\d+)/, "Chromium"],
		[/Chrome\/(\d+)/, "Chrome"],
		[/Firefox\/(\d+)/, "Firefox"],
		[/(?:Version\/(\d+).*)?Safari\//, "Safari"],
		[/MSIE (\d+)/, "IE"],
		[/Trident\/.*rv:(\d+)/, "IE"],
	];

	for (const [pattern, name] of patterns) {
		const version = userAgent.match(pattern)?.[1];
		if (version) return `${name} ${version}`;
		if (pattern.test(userAgent)) return name;
	}
	if (/okhttp/i.test(userAgent)) return "Android App";
	if (/CFNetwork/i.test(userAgent)) return "iOS App";
	if (/PostmanRuntime/i.test(userAgent)) return "Postman";
	if (/curl/i.test(userAgent)) return "cURL";
	if (/insomnia/i.test(userAgent)) return "Insomnia";
	return null;
}

function parseOS(userAgent: string): string | null {
	if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
	if (/Mac OS X|macOS/i.test(userAgent)) return "macOS";
	if (/Android/i.test(userAgent)) return "Android";
	if (/Windows/i.test(userAgent)) return "Windows";
	if (/Linux/i.test(userAgent)) return "Linux";
	if (/CrOS/i.test(userAgent)) return "Chrome OS";
	return null;
}
