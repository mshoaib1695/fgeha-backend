import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: import('nodemailer').Transporter | null = null;
  private readonly appUrl: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.appUrl = this.config.get('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
    this.from = this.config.get('MAIL_FROM', 'noreply@example.com');
    const host = this.config.get('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    if (host && user && pass) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodemailer = require('nodemailer') as typeof import('nodemailer');
        this.transporter = nodemailer.createTransport({
          host,
          port: Number(port),
          secure: port === 465,
          auth: { user, pass },
        });
      } catch (e) {
        this.logger.warn('Nodemailer not installed or SMTP config invalid. Run: npm install nodemailer');
      }
    }
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/auth/verify-email?token=${encodeURIComponent(code)}`;
    const html = `
      <p>Your verification code is:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Enter this code in the app to verify your email.</p>
      <p>Or <a href="${verifyUrl}">click here to verify</a>.</p>
      <p>This code expires in 24 hours.</p>
    `;
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: email,
          subject: 'Verify your email - FGEHA RSP',
          html,
        });
        this.logger.log(`Verification email sent to ${email}`);
      } catch (err) {
        this.logger.error(`Failed to send verification email to ${email}`, err);
      }
    } else {
      this.logger.log(`[No SMTP] Verification code for ${email}: ${code}`);
    }
  }
}
