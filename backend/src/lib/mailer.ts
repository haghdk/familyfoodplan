import { createTransport, type Transporter } from "nodemailer";

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const smtpHost = process.env.SMTP_HOST?.trim();
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpSecure = process.env.SMTP_SECURE === "true";

export const mailFromAddress =
  process.env.MAIL_FROM?.trim() || "Family Food Planner <no-reply@familyfoodplan.local>";

export const isEmailConfigured = Boolean(smtpHost);

let cachedTransporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!smtpHost) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      ...(smtpUser && smtpPassword
        ? { auth: { user: smtpUser, pass: smtpPassword } }
        : {})
    });
  }

  return cachedTransporter;
};

/**
 * Sends an email through the configured SMTP server.
 *
 * When no SMTP host is configured (local development), the message is logged to
 * the server console instead so the flow stays usable without a mail provider.
 */
export const sendEmail = async (email: OutgoingEmail): Promise<boolean> => {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      [
        "[mailer] SMTP is not configured, so this email was not sent.",
        `  To:      ${email.to}`,
        `  Subject: ${email.subject}`,
        email.text.split("\n").map((line) => `  ${line}`).join("\n")
      ].join("\n")
    );

    return false;
  }

  try {
    await transporter.sendMail({
      from: mailFromAddress,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html
    });

    return true;
  } catch (error) {
    console.error("[mailer] Failed to send email:", error);
    return false;
  }
};
