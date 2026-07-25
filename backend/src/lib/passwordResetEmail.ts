import type { OutgoingEmail } from "./mailer";

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
  expiresInMinutes
}: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}): OutgoingEmail => {
  const safeResetUrl = escapeHtml(resetUrl);

  const text = [
    "Hi,",
    "",
    "We received a request to reset the password for your Family Food Planner account.",
    "",
    "Open this link to choose a new password:",
    resetUrl,
    "",
    `The link expires in ${expiresInMinutes} minutes and can only be used once.`,
    "",
    "If you did not request a password reset you can ignore this email — your password stays unchanged.",
    "",
    "— Family Food Planner"
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f6f4ef;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1a16;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background-color:#ffffff;border:1px solid #e7e2d7;border-radius:16px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#2c7a5b;">Family Food Planner</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1b1a16;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#56524a;">
            We received a request to reset the password for your Family Food Planner account.
            Choose a new password with the button below.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${safeResetUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background-color:#2c7a5b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Choose a new password</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#56524a;">
            The link expires in ${expiresInMinutes} minutes and can only be used once.
            If the button does not work, copy this address into your browser:
          </p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;color:#8a8477;">${safeResetUrl}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8477;">
            If you did not request a password reset you can ignore this email — your password stays unchanged.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to,
    subject: "Reset your Family Food Planner password",
    text,
    html
  };
};
