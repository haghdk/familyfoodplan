import { Router } from "express";
import { createSessionToken, sessionMaxAgeSeconds } from "../auth/session";
import { validateUserLogin } from "../auth/login";
import {
  createPasswordResetToken,
  isPasswordResetTokenValid,
  minimumPasswordLength,
  passwordResetTokenTtlMinutes,
  resetPasswordWithToken
} from "../auth/passwordReset";
import { requireAuth } from "../middleware/auth";
import { sendEmail } from "../lib/mailer";
import { buildPasswordResetEmail, buildPasswordResetUrl } from "../lib/passwordResetEmail";
import { createRateLimiter } from "../lib/rateLimit";
import { requestLocale, translate, translatePlural, userLocale } from "../i18n";

const authRouter = Router();

// Password reset emails are the one unauthenticated endpoint that causes
// outbound mail, so cap how often a single address or client can trigger it.
const forgotPasswordRateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000
});

authRouter.post("/api/auth/login", async (request, response) => {
  const locale = requestLocale(request);
  const { email, password } = request.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    response
      .status(400)
      .json({ message: translate(locale, "auth.credentialsRequired") });
    return;
  }

  const user = await validateUserLogin({ email, password });

  if (!user) {
    response
      .status(401)
      .json({ message: translate(locale, "auth.invalidCredentials") });
    return;
  }

  const token = createSessionToken(user);

  response.setHeader(
    "Set-Cookie",
    `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`
  );

  response.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      // Lets the browser adopt the account's language straight after sign-in,
      // which is how a second device ends up in the right one.
      language: await userLocale(user.id)
    }
  });
});

authRouter.post("/api/auth/logout", (_request, response) => {
  response.setHeader(
    "Set-Cookie",
    "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
  response.status(200).json({ success: true });
});

authRouter.get("/api/auth/me", requireAuth, (_request, response) => {
  response.status(200).json({ user: response.locals.user });
});

/**
 * Starts the forgot-password flow. Always answers 200 with the same body, so an
 * unauthenticated caller cannot use it to discover which emails have accounts.
 */
authRouter.post("/api/auth/forgot-password", async (request, response) => {
  const locale = requestLocale(request);
  const { email } = request.body as { email?: string };
  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail) {
    response.status(400).json({ message: translate(locale, "auth.emailRequired") });
    return;
  }

  const rateLimitKey = `${request.ip ?? "unknown"}:${normalizedEmail}`;

  if (!forgotPasswordRateLimiter.tryConsume(rateLimitKey)) {
    response.status(429).json({
      message: translate(locale, "auth.tooManyResetRequests")
    });
    return;
  }

  const acknowledgement = {
    message: translate(locale, "auth.resetAcknowledgement"),
    expiresInMinutes: passwordResetTokenTtlMinutes
  };

  try {
    const resetRequest = await createPasswordResetToken(normalizedEmail);

    if (!resetRequest) {
      response.status(200).json(acknowledgement);
      return;
    }

    const resetUrl = buildPasswordResetUrl(resetRequest.token);

    await sendEmail(
      buildPasswordResetEmail({
        to: resetRequest.user.email,
        resetUrl,
        expiresInMinutes: passwordResetTokenTtlMinutes,
        // The mail belongs to the account, not to whoever filled in the form,
        // so it is written in the owner's language rather than the caller's.
        locale: await userLocale(resetRequest.user.id)
      })
    );
  } catch (error) {
    console.error("[auth] Failed to start password reset:", error);
  }

  response.status(200).json(acknowledgement);
});

/** Lets the reset screen tell an expired or reused link from a working one. */
authRouter.get("/api/auth/reset-password/:token", async (request, response) => {
  const isValid = await isPasswordResetTokenValid(request.params.token);

  response.status(200).json({ valid: isValid });
});

authRouter.post("/api/auth/reset-password", async (request, response) => {
  const locale = requestLocale(request);
  const { token, password } = request.body as {
    token?: string;
    password?: string;
  };

  if (!token || !password) {
    response
      .status(400)
      .json({ message: translate(locale, "auth.tokenAndPasswordRequired") });
    return;
  }

  const result = await resetPasswordWithToken(token, password);

  if (result.status === "weak_password") {
    response.status(400).json({
      message: translatePlural(locale, "auth.passwordTooShort", minimumPasswordLength)
    });
    return;
  }

  if (result.status === "invalid_token") {
    response.status(400).json({
      message: translate(locale, "auth.resetLinkInvalid")
    });
    return;
  }

  response.status(200).json({ success: true });
});

export default authRouter;
