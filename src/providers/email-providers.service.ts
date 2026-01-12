import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  EmailServiceProvider,
  SmtpCredentials,
} from '../entities/accounts.entity';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  htmlContent: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: EmailServiceProvider;
}

@Injectable()
export class EmailProvidersService {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }

  async sendEmail(
    account: Account,
    payload: EmailPayload,
  ): Promise<SendEmailResult> {
    try {
      switch (account.provider) {
        case EmailServiceProvider.SMTP:
          return await this.sendViaSmtp(account, payload);
        default:
          throw new BadRequestException(
            `Unsupported provider: ${account.provider}`,
          );
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: account.provider,
      };
    }
  }

  async sendViaSmtp(
    account: Account,
    payload: EmailPayload,
  ): Promise<SendEmailResult> {
    const credentials = account.getTypedCredentials(
      this.encryptionKey,
    ) as SmtpCredentials;

    // Create transporter with SMTP credentials
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: account.email,
        pass: 'nwli lzmt irjb tcex',
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"${payload.fromName || account.name}" <${payload.fromEmail || account.email}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.htmlContent,
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: 'stmp' as EmailServiceProvider,
    };
  }
}
