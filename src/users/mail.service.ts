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

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    const html = `
      <p>You requested to reset your password. Your reset code is:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Enter this code in the app to set a new password.</p>
      <p>This code expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `;
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: email,
          subject: 'Reset your password - FGEHA RSP',
          html,
        });
        this.logger.log(`Password reset email sent to ${email}`);
      } catch (err) {
        this.logger.error(`Failed to send password reset email to ${email}`, err);
      }
    } else {
      this.logger.log(`[No SMTP] Password reset code for ${email}: ${code}`);
    }
  }

  async sendOutstandingPaymentNoticeEmail(input: {
    to: string;
    fullName?: string | null;
    houseNo: string;
    streetNo: string;
    subSector?: string | null;
    subSectorId?: number | null;
    charges: Array<{ category: string; amount: number }>;
    totalOutstanding: number;
    dueDate: string | null;
    graceDays?: number;
    entryType?: 'charge' | 'payment' | 'adjustment';
    entryCategory?: string | null;
    entryAmount?: number;
    message: string;
  }): Promise<void> {
    const formatPKR = (value: number): string => `PKR ${Number(value || 0).toFixed(2)}`;
    const dueDateObj = input.dueDate ? new Date(input.dueDate) : null;
    const dueDateText = dueDateObj
      ? dueDateObj.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        })
      : 'Not set';
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    const daysDiff = dueDateObj ? Math.ceil((dueDateObj.getTime() - now.getTime()) / msInDay) : null;
    const dueStatusLine =
      daysDiff == null
        ? 'Due date is not set.'
        : daysDiff > 0
          ? `Time Remaining: ${daysDiff} day${daysDiff === 1 ? '' : 's'}`
          : daysDiff === 0
            ? 'Time Remaining: Due today'
            : `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'}`;
    const graceDays = Number(input.graceDays ?? 0);
    const graceLine =
      graceDays > 0
        ? `<p>For your convenience, we have kept a ${graceDays}-day grace period from the notice date.</p>`
        : '';
    const entryType = input.entryType ?? 'charge';
    const entryCategory = input.entryCategory?.trim() || 'General';
    const entryAmount = Number(input.entryAmount ?? 0);
    const eventLine = entryAmount > 0 ? `${entryCategory}: ${entryAmount.toFixed(2)}` : '';
    const subject =
      entryType === 'payment'
        ? 'Payment received - FGEHA RSP'
        : entryType === 'adjustment'
          ? 'Account adjustment update - FGEHA RSP'
          : 'Outstanding payment notice - FGEHA RSP';
    const paymentMessage = `
      <p>Thank you for your payment of <strong>${formatPKR(entryAmount)}</strong>. We have successfully received and recorded it.</p>
      <p><strong>Property Details:</strong></p>
      <ul>
        <li>Sub-sector: ${input.subSector?.trim() || (input.subSectorId != null ? `#${input.subSectorId}` : 'N/A')}</li>
        <li>House: ${input.houseNo}</li>
        <li>Street: ${input.streetNo}</li>
      </ul>
      <p><strong>Payment Summary:</strong></p>
      <ul>
        <li>Received Amount: ${formatPKR(entryAmount)}</li>
        <li>Remaining Outstanding Balance: ${formatPKR(input.totalOutstanding)}</li>
        <li>Due Date: ${dueDateText}</li>
        <li>${dueStatusLine}</li>
      </ul>
      ${
        Number(input.totalOutstanding) <= 0
          ? '<p><strong>Your account is now fully cleared.</strong> No outstanding balance remains, and your services continue without interruption.</p>'
          : '<p>We kindly request you to clear the remaining outstanding amount by the due date to ensure uninterrupted services.</p>'
      }
      <p>If you have any questions or require further clarification, please feel free to contact us.</p>
      <p>Thank you for your continued cooperation.</p>
      <p>Best regards,<br/>FGEHA RSP</p>
    `;
    const chargeMessage = `
      <p>A new charge has been added to your house account${eventLine ? ` (${eventLine})` : ''}.</p>
      <ul>
        <li>Sub-sector: ${input.subSector?.trim() || (input.subSectorId != null ? `#${input.subSectorId}` : 'N/A')}</li>
        <li>House: ${input.houseNo}</li>
        <li>Street: ${input.streetNo}</li>
        ${entryAmount > 0 ? `<li>New Charge Amount: <strong>${entryAmount.toFixed(2)}</strong></li>` : ''}
        <li><strong>Total Outstanding: ${input.totalOutstanding.toFixed(2)}</strong></li>
        <li>Due Date: ${dueDateText}</li>
        <li>${dueStatusLine}</li>
      </ul>
      <p>${input.message}</p>
      ${graceLine}
      <p>Thank you for your cooperation.</p>
    `;
    const adjustmentMessage = `
      <p>Your house account has been updated with an adjustment${eventLine ? ` (${eventLine})` : ''}.</p>
      <ul>
        <li>Sub-sector: ${input.subSector?.trim() || (input.subSectorId != null ? `#${input.subSectorId}` : 'N/A')}</li>
        <li>House: ${input.houseNo}</li>
        <li>Street: ${input.streetNo}</li>
        <li><strong>Total Outstanding: ${input.totalOutstanding.toFixed(2)}</strong></li>
        <li>Due Date: ${dueDateText}</li>
        <li>${dueStatusLine}</li>
      </ul>
      <p>${input.message}</p>
      ${graceLine}
      <p>Thank you for your cooperation.</p>
    `;
    const html = `
      <p>Dear ${input.fullName?.trim() || 'Resident'},</p>
      ${
        entryType === 'payment'
          ? paymentMessage
          : entryType === 'adjustment'
            ? adjustmentMessage
            : chargeMessage
      }
    `;
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: input.to,
          subject,
          html,
        });
        this.logger.log(`Outstanding payment notice email sent to ${input.to}`);
      } catch (err) {
        this.logger.error(`Failed to send outstanding payment notice email to ${input.to}`, err);
      }
    } else {
      this.logger.log(
        `[No SMTP] Outstanding payment notice for ${input.to}: total=${input.totalOutstanding.toFixed(2)}, due=${dueDateText}`,
      );
    }
  }
}
