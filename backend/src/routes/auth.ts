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

const authRouter = Router();

// Password reset emails are the one unauthenticated endpoint that causes
// outbound mail, so cap how often a single address or client can trigger it.
const forgotPasswordRateLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000
});

authRouter.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    response.status(400).json({ message: "Email and password are required" });
    return;
  }

  const user = await validateUserLogin({ email, password });

  if (!user) {
    response.status(401).json({ message: "Invalid credentials" });
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
      role: user.role
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
  const { email } = request.body as { email?: string };
  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail) {
    response.status(400).json({ message: "Email is required." });
    return;
  }

  const rateLimitKey = `${request.ip ?? "unknown"}:${normalizedEmail}`;

  if (!forgotPasswordRateLimiter.tryConsume(rateLimitKey)) {
    response.status(429).json({
      message: "Too many reset requests. Please try again in a few minutes."
    });
    return;
  }

  const acknowledgement = {
    message:
      "If that email address has an account, a password reset link is on its way.",
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
        expiresInMinutes: passwordResetTokenTtlMinutes
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
  const { token, password } = request.body as {
    token?: string;
    password?: string;
  };

  if (!token || !password) {
    response.status(400).json({ message: "Token and password are required." });
    return;
  }

  const result = await resetPasswordWithToken(token, password);

  if (result.status === "weak_password") {
    response.status(400).json({
      message: `Password must be at least ${minimumPasswordLength} characters.`
    });
    return;
  }

  if (result.status === "invalid_token") {
    response.status(400).json({
      message: "This reset link is no longer valid. Please request a new one."
    });
    return;
  }

  response.status(200).json({ success: true });
});

export default authRouter;
