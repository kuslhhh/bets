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
export const PASSWORD_RESET_OTP_TTL_MINUTES = 10;

export function passwordResetEmail(to: string, resetLink: string): MailMessage {
  const text = [
    "You requested a password reset for your Finance Assessment account.",
    "",
    `Reset link (valid ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes): ${resetLink}`,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0f172a;padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.2px;">Finance Assessment</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Business Health &amp; Financial Maturity</p>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;">Reset your password</h2>
      <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:22px;">You requested a password reset for your Finance Assessment account. Click the button below to set a new password. This link is valid for ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes and can be used only once.</p>
      <p style="margin:20px 0;">
        <a href="${resetLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600;">Reset password</a>
      </p>
      <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:20px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="margin:0 0 16px;word-break:break-all;"><a href="${resetLink}" style="color:#0f172a;font-size:13px;">${resetLink}</a></p>
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:20px;">If you did not request this, you can safely ignore this email. Your password will not change.</p>
    </div>
    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated message — please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
  return { to, subject: "Reset your password", text, html };
}

export function passwordResetOtpEmail(to: string, otp: string): MailMessage {
  const text = [
    "You requested a password reset for your Finance Assessment account.",
    "",
    `Your OTP is: ${otp} (valid ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes, single use)`,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0f172a;padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.2px;">Finance Assessment</h1>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Business Health &amp; Financial Maturity</p>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;">Your OTP for password reset</h2>
      <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:22px;">Use the code below to reset your password. This code is valid for ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes and can be used only once.</p>
      <p style="margin:20px 0;text-align:center;">
        <span style="display:inline-block;background:#f1f5f9;border:1px dashed #cbd5e1;color:#0f172a;font-size:28px;font-weight:800;letter-spacing:8px;padding:14px 24px;border-radius:8px;">${otp}</span>
      </p>
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:20px;">If you did not request this, you can safely ignore this email. Your password will not change.</p>
    </div>
    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated message — please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
  return { to, subject: `Your OTP is ${otp}`, text, html };
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

export async function sendPasswordResetOtpEmail(to: string, otp: string): Promise<{ delivered: boolean }> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[otp:dev] email OTP for ${to}: ${otp}`);
  }
  return sendMail(passwordResetOtpEmail(to, otp));
}
