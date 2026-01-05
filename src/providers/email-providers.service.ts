import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  EmailServiceProvider,
  BrevoCredentials,
  SendGridCredentials,
  MailgunCredentials,
  AwsSesCredentials,
} from '../entities/accounts.entity';
import * as brevo from '@getbrevo/brevo';
import { EmailRecipient } from 'src/entities/email-recipients.entity';

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
        // case EmailServiceProvider.BREVO:
        //   return await this.sendViaBrevo();
        case EmailServiceProvider.SENDGRID:
          return await this.sendViaSendGrid(account, payload);
        case EmailServiceProvider.MAILGUN:
          return await this.sendViaMailgun(account, payload);
        case EmailServiceProvider.AWS_SES:
          return await this.sendViaAwsSes(account, payload);
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

  async sendViaBrevo(
    account: Account,
    recipient: EmailRecipient,
    content: string,
  ): Promise<SendEmailResult> {
    const credentials = account.getTypedCredentials(
      this.encryptionKey,
    ) as BrevoCredentials;

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      credentials.api_key,
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = 'Yêu cầu demo từ eMover';
    sendSmtpEmail.htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Thông tin Liên hệ</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        h2 { color: #0056b3; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .data-item { margin-bottom: 15px; }
        .label { font-weight: bold; color: #555; display: inline-block; width: 120px; }
        .value { color: #000; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Chi tiết Thông tin Khách hàng</h2>
        
        <div class="data-item">
            <span class="label">Tên:</span>
            <span class="value">
               ${recipient.name || ''}
            </span>
        </div>
        
        <div class="data-item">
            <span class="label">Điện thoại:</span>
            <span class="value">
               ${recipient.name || ''}
            </span>
        </div>
        
        <div class="data-item">
            <span class="label">Email:</span>
            <span class="value">
              ${recipient.email || ''}
            </span>
        </div>
        
   
          <div class="data-item">
            <span class="label">Ghi chú:</span>
            <span class="value">
                ${content || ''}
            </span>
        </div>
    </div>
</body>
</html>`;
    sendSmtpEmail.sender = {
      email: account.email,
      name: account.name,
    };
    sendSmtpEmail.to = [{ email: recipient.email }];
    await apiInstance.sendTransacEmail(sendSmtpEmail);

    return {
      success: true,
      messageId: 'Gửi thành công',
      provider: EmailServiceProvider.BREVO,
    };
  }

  private async sendViaSendGrid(
    account: Account,
    payload: EmailPayload,
  ): Promise<SendEmailResult> {
    const credentials = account.getTypedCredentials(
      this.encryptionKey,
    ) as SendGridCredentials;

    // TODO: Implement SendGrid API call
    // https://api.sendgrid.com/v3/mail/send
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.api_key}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: payload.to }],
          },
        ],
        from: {
          email: payload.fromEmail || account.email,
          name: payload.fromName || account.name,
        },
        subject: payload.subject,
        content: [
          {
            type: 'text/html',
            value: payload.htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }

    return {
      success: true,
      messageId: response.headers.get('x-message-id'),
      provider: EmailServiceProvider.SENDGRID,
    };
  }

  private async sendViaMailgun(
    account: Account,
    payload: EmailPayload,
  ): Promise<SendEmailResult> {
    const credentials = account.getTypedCredentials(
      this.encryptionKey,
    ) as MailgunCredentials;

    const region = credentials.region || 'us';
    const baseUrl =
      region === 'eu'
        ? 'https://api.eu.mailgun.net'
        : 'https://api.mailgun.net';

    // TODO: Implement Mailgun API call
    const formData = new URLSearchParams();
    formData.append(
      'from',
      `${payload.fromName || account.name} <${payload.fromEmail || account.email}>`,
    );
    formData.append('to', payload.to);
    formData.append('subject', payload.subject);
    formData.append('html', payload.htmlContent);

    const response = await fetch(
      `${baseUrl}/v3/${credentials.domain}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${credentials.api_key}`).toString('base64')}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mailgun API error: ${error}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
      provider: EmailServiceProvider.MAILGUN,
    };
  }

  private async sendViaAwsSes(
    account: Account,
    payload: EmailPayload,
  ): Promise<SendEmailResult> {
    const credentials = account.getTypedCredentials(
      this.encryptionKey,
    ) as AwsSesCredentials;

    // TODO: Implement AWS SES SDK call
    // For now, return placeholder
    throw new Error('AWS SES implementation pending - requires AWS SDK');
  }
}
