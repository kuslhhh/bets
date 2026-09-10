import type { MailMessage } from "./mailer";

// Minimal reset email. No branding work in the backend phase.
// The link target ({APP_URL}/reset-password?token=…) is a frontend-phase page;
// the backend only issues and validates tokens (Phase 3 routes).

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
