// ─── TOTP Service ─────────────────────────────────────────────────────────
// Infrastructure implementation of ITotpService using otpauth + qrcode

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import type { ITotpService } from '../../application/ports/totp.port.js';

export class TotpService implements ITotpService {
  generateSecret(issuer: string, accountName: string): { secret: string; otpAuthUrl: string } {
    const totp = new OTPAuth.TOTP({
      issuer,
      label: accountName,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });

    return {
      secret: totp.secret.base32,
      otpAuthUrl: totp.toString(),
    };
  }

  async generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  verifyToken(secret: string, token: string): boolean {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Allow window of ±1 period (30s before/after)
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  }
}
