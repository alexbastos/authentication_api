// ─── GeoIP Service ────────────────────────────────────────────────────────
// Resolves IP addresses to geographic locations using a local MaxMind database.
// No external API calls — fast and privacy-friendly.

import geoip from 'geoip-lite';
import type { IGeoIpService } from '../../application/ports/geo-ip.port.js';
import type { GeoLocation } from '../../domain/entities/session.entity.js';

// ISO 3166-1 country names (subset of most common)
const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina', AU: 'Australia',
  AT: 'Austria', BE: 'Belgium', BR: 'Brazil', CA: 'Canada', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CR: 'Costa Rica', HR: 'Croatia', CZ: 'Czech Republic',
  DK: 'Denmark', EC: 'Ecuador', EG: 'Egypt', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary', IN: 'India',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IT: 'Italy', JP: 'Japan',
  KR: 'South Korea', MY: 'Malaysia', MX: 'Mexico', NL: 'Netherlands', NZ: 'New Zealand',
  NO: 'Norway', PK: 'Pakistan', PE: 'Peru', PH: 'Philippines', PL: 'Poland',
  PT: 'Portugal', RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia', SG: 'Singapore',
  ZA: 'South Africa', ES: 'Spain', SE: 'Sweden', CH: 'Switzerland', TW: 'Taiwan',
  TH: 'Thailand', TR: 'Turkey', UA: 'Ukraine', AE: 'United Arab Emirates',
  GB: 'United Kingdom', US: 'United States', UY: 'Uruguay', VE: 'Venezuela',
  VN: 'Vietnam',
};

export class GeoIpService implements IGeoIpService {
  lookup(ip: string): GeoLocation | null {
    // Skip private/localhost IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      return null;
    }

    const geo = geoip.lookup(ip);
    if (!geo) return null;

    return {
      city: geo.city || null,
      region: geo.region || null,
      countryCode: geo.country || null,
      countryName: COUNTRY_NAMES[geo.country] ?? geo.country ?? null,
    };
  }
}
