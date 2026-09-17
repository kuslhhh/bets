import nodemailer from "nodemailer";
import { getSmtpConfig, isSmtpConfigured } from "../lib/config";
import { passwordResetEmail, passwordResetLink, passwordResetOtpEmail, type MailMessage } from "../lib/email";

export class MailService {
  private getTransporter() {
    const smtp = getSmtpConfig();
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
  }

  async sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
    if (!isSmtpConfigured()) {
      console.log("[mail:dev] skipped SMTP (SMTP_HOST unset)", {
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { delivered: false };
    }
    await this.getTransporter().sendMail({
      from: getSmtpConfig().from,
      ...message,
    });
    return { delivered: true };
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<{ delivered: boolean }> {
    return this.sendMail(passwordResetEmail(to, passwordResetLink(token)));
  }

  async sendPasswordResetOtpEmail(to: string, otp: string): Promise<{ delivered: boolean }> {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[otp:dev] sendPasswordResetOtpEmail to ${to}: ${otp}`);
    }
    return this.sendMail(passwordResetOtpEmail(to, otp));
  }
}

// Singleton for convenience where DI is not needed
export const mailService = new MailService();
