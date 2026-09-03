// ─── Application Port ─────────────────────────────────────────────────────
// Contract for TOTP operations — implemented by infrastructure layer

export interface ITotpService {
  generateSecret(issuer: string, accountName: string): { secret: string; otpAuthUrl: string };
  generateQrCodeDataUrl(otpAuthUrl: string): Promise<string>;
  verifyToken(secret: string, token: string): boolean;
}
