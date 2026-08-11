// ─── User-Agent Parser Utility ────────────────────────────────────────────
// Lightweight parser — no external dependencies

/**
 * Extracts a human-readable device name from a User-Agent string.
 * Example: "Chrome 120 - macOS" or "Safari - iOS" or "Firefox 121 - Windows"
 */
export function parseDeviceName(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;

  const browser = parseBrowser(userAgent);
  const os = parseOS(userAgent);

  if (!browser && !os) return null;
  if (!browser) return os!;
  if (!os) return browser;

  return `${browser} - ${os}`;
}

function parseBrowser(ua: string): string | null {
  // Order matters — check more specific patterns first
  const patterns: [RegExp, string][] = [
    [/Edg(?:e)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/(?:Chromium|CriOS)\/(\d+)/, 'Chromium'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/(?:Version\/(\d+).*)?Safari\//, 'Safari'],
    [/MSIE (\d+)/, 'IE'],
    [/Trident\/.*rv:(\d+)/, 'IE'],
  ];

  for (const [regex, name] of patterns) {
    const match = ua.match(regex);
    if (match) {
      const version = match[1];
      return version ? `${name} ${version}` : name;
    }
  }

  // Check for mobile apps / bots
  if (/okhttp/i.test(ua)) return 'Android App';
  if (/CFNetwork/i.test(ua)) return 'iOS App';
  if (/PostmanRuntime/i.test(ua)) return 'Postman';
  if (/curl/i.test(ua)) return 'cURL';
  if (/insomnia/i.test(ua)) return 'Insomnia';

  return null;
}

function parseOS(ua: string): string | null {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X|macOS/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/CrOS/i.test(ua)) return 'Chrome OS';

  return null;
}
