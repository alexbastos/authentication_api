// ─── Application Port ─────────────────────────────────────────────────────
// Contract for email sending — implemented by infrastructure layer
// In development: console.log; In production: AWS SES, SendGrid, etc.

export interface IEmailService {
  sendVerificationEmail(to: string, name: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, name: string, token: string): Promise<void>;
}
