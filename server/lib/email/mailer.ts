import nodemailer from "nodemailer";

// Generic-SMTP mailer (Nodemailer). Portable: no Bun-only APIs.
// Dev behaviour: if SMTP_HOST is unset, delivery is skipped and the
// would-be email is logged to console (backend log = deliverability in dev).
// Production requires SMTP_* env (PROJECT.md §17).

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
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
