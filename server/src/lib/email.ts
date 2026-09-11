import nodemailer from "nodemailer";

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
  const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
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
    from: process.env.SMTP_FROM ?? "no-reply@localhost",
    ...message,
  });
  return { delivered: true };
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<{ delivered: boolean }> {
  return sendMail(passwordResetEmail(to, passwordResetLink(token)));
}
