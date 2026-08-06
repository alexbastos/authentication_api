// ─── Console Email Service ────────────────────────────────────────────────
// Development implementation of IEmailService
// Logs emails to console instead of sending them.
// In production, replace with AWS SES, Resend, or SendGrid implementation.

import type { IEmailService } from '../../application/ports/email.port.js';

export class ConsoleEmailService implements IEmailService {
  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const line = '═'.repeat(60);
    console.log(`\n${line}`);
    console.log('[EMAIL] 📧 Verificação de Conta');
    console.log(`Para: ${to} (${name})`);
    console.log(`Assunto: Confirme seu endereço de e-mail`);
    console.log(`Token: ${token}`);
    console.log(`[Dica] No frontend, chame: POST /authentication_api/api/v1/auth/verify-email { token: "<token>" }`);
    console.log(`${line}\n`);
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const line = '═'.repeat(60);
    console.log(`\n${line}`);
    console.log('[EMAIL] 🔑 Redefinição de Senha');
    console.log(`Para: ${to} (${name})`);
    console.log(`Assunto: Redefinir sua senha`);
    console.log(`Token: ${token}`);
    console.log(`[Dica] No frontend, chame: POST /authentication_api/api/v1/auth/reset-password { token: "<token>", newPassword: "..." }`);
    console.log(`Expira em: 1 hora`);
    console.log(`${line}\n`);
  }
}
