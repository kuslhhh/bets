import nodemailer from "nodemailer";
import { getAppUrl, getSmtpConfig, isSmtpConfigured } from "./config";

// Generic SMTP via Nodemailer. If SMTP_HOST unset, log to console (dev).

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;

export function passwordResetEmail(to: string, resetLink: string): MailMessage {
  const text = [
    "You requested a password reset for your Finance Assessment account.",
    "",
    `Reset link (valid ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes): ${resetLink}`,
    "",
    "If you did not request this, ignore this email.",
  ].join("\n");
  const html = [
    "<p>You requested a password reset for your Finance Assessment account.</p>",
    `<p><a href="${resetLink}">Reset password</a> (valid ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes).</p>`,
    "<p>If you did not request this, ignore this email.</p>",
  ].join("\n");
  return { to, subject: "Reset your password", text, html };
}

export function passwordResetLink(token: string): string {
  return `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

function getTransporter() {
  const smtp = getSmtpConfig();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
}

export async function sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
  if (!isSmtpConfigured()) {
    console.log("[mail:dev] skipped SMTP (SMTP_HOST unset)", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { delivered: false };
  }
  await getTransporter().sendMail({
    from: getSmtpConfig().from,
    ...message,
  });
  return { delivered: true };
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<{ delivered: boolean }> {
  return sendMail(passwordResetEmail(to, passwordResetLink(token)));
}
