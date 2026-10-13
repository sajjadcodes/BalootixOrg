import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly frontendUrl: string;

  constructor(configService: ConfigService) {
    this.resend = new Resend(
      configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.from = configService.getOrThrow<string>('RESEND_FROM_EMAIL');
    this.appUrl = configService.getOrThrow<string>('APP_URL');
    this.frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const baseUrl = this.appUrl.replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Verify your email address',
      text: `Verify your email address by opening this link: ${verificationUrl}\n\nThis link expires in 30 minutes.`,
    });

    if (error) {
      throw new Error(
        `Resend failed to send verification email: ${error.message}`,
      );
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const baseUrl = this.appUrl.replace(/\/$/, '');
    const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Reset your password',
      text: `Reset your password by opening this link: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });

    if (error) {
      throw new Error(
        `Resend failed to send password reset email: ${error.message}`,
      );
    }
  }

  async sendOwnerSetupEmail(email: string, token: string): Promise<void> {
    const baseUrl = this.frontendUrl.replace(/\/$/, '');
    const setupUrl = `${baseUrl}/owner-setup?token=${encodeURIComponent(token)}`;
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Set up your Baloot Org owner account',
      text: `Set up your Baloot Org owner account by opening this link: ${setupUrl}\n\nThis link expires in 30 minutes and can only be used once.`,
    });

    if (error) {
      throw new Error(
        `Resend failed to send owner setup email: ${error.message}`,
      );
    }
  }
}
