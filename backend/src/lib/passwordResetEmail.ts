import type { OutgoingEmail } from "./mailer";
import { defaultLocale, translate, translatePlural, type Locale } from "../i18n";

/**
 * Public URL the reset link should point at. In Docker the backend talks to the
 * frontend over an internal hostname, so prefer the browser-facing origin.
 */
const appPublicUrl = (
  process.env.APP_PUBLIC_URL ||
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export const buildPasswordResetUrl = (token: string): string =>
  `${appPublicUrl}/reset-password?token=${encodeURIComponent(token)}`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildPasswordResetEmail = ({
  to,
  resetUrl,
  expiresInMinutes,
  locale = defaultLocale
}: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
  locale?: Locale;
}): OutgoingEmail => {
  const safeResetUrl = escapeHtml(resetUrl);
  const message = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const expiryLine = translatePlural(
    locale,
    "passwordResetEmail.expiry",
    expiresInMinutes
  );

  const text = [
    message("passwordResetEmail.greeting"),
    "",
    message("passwordResetEmail.intro"),
    "",
    message("passwordResetEmail.openLink"),
    resetUrl,
    "",
    expiryLine,
    "",
    message("passwordResetEmail.ignore"),
    "",
    message("passwordResetEmail.signature")
  ].join("\n");

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:24px;background-color:#f6f4ef;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1a16;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background-color:#ffffff;border:1px solid #e7e2d7;border-radius:16px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#2c7a5b;">${escapeHtml(message("passwordResetEmail.brand"))}</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1b1a16;">${escapeHtml(message("passwordResetEmail.heading"))}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#56524a;">
            ${escapeHtml(message("passwordResetEmail.htmlIntro"))}
          </p>
          <p style="margin:0 0 24px;">
            <a href="${safeResetUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background-color:#2c7a5b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(message("passwordResetEmail.button"))}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#56524a;">
            ${escapeHtml(expiryLine)}
            ${escapeHtml(message("passwordResetEmail.fallbackLink"))}
          </p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;color:#8a8477;">${safeResetUrl}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8477;">
            ${escapeHtml(message("passwordResetEmail.ignore"))}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to,
    subject: message("passwordResetEmail.subject"),
    text,
    html
  };
};
