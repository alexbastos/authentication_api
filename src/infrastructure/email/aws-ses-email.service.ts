import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { IEmailService } from '../../application/ports/email.port.js';

export class AwsSesEmailService implements IEmailService {
  private readonly client: SESClient;
  private readonly sourceEmail: string;
  private readonly appUrl: string;

  constructor(sourceEmail: string, appUrl: string, region: string) {
    this.sourceEmail = sourceEmail;
    this.appUrl = appUrl;
    // Em produção via EC2 Instance Profile, as credenciais são resolvidas automaticamente
    this.client = new SESClient({ region });
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    
    const command = new SendEmailCommand({
      Source: this.sourceEmail,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: 'Confirme seu endereço de e-mail',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <h2>Olá, ${name}!</h2>
              <p>Obrigado por se registrar. Para concluir seu cadastro, precisamos confirmar seu e-mail.</p>
              <p>Por favor, clique no link abaixo para validar sua conta:</p>
              <a href="${link}">${link}</a>
              <p>Ou se preferir, use este token diretamente: <strong>${token}</strong></p>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `Olá, ${name}!\n\nConfirme seu e-mail acessando: ${link}\nOu usando o token: ${token}`,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      await this.client.send(command);
    } catch (error) {
      console.error('[AWS SES] Falha ao enviar e-mail de verificação', error);
      throw new Error('Falha ao enviar e-mail. Verifique o provedor.');
    }
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`;

    const command = new SendEmailCommand({
      Source: this.sourceEmail,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: 'Redefinição de Senha',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <h2>Olá, ${name}.</h2>
              <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
              <p>Para criar uma nova senha, clique no link abaixo:</p>
              <a href="${link}">${link}</a>
              <p>Ou se preferir, use este token diretamente: <strong>${token}</strong></p>
              <p><small>Este link expirará em 1 hora. Se você não solicitou isso, pode ignorar este e-mail.</small></p>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `Olá, ${name}.\n\nRedefina sua senha acessando: ${link}\nOu usando o token: ${token}`,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      await this.client.send(command);
    } catch (error) {
      console.error('[AWS SES] Falha ao enviar e-mail de redefinição de senha', error);
      throw new Error('Falha ao enviar e-mail. Verifique o provedor.');
    }
  }
}
