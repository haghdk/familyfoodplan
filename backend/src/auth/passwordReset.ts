import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "../lib/prisma";
import { hashPassword } from "./password";

export const minimumPasswordLength = 6;

const tokenTtlMinutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 60;

export const passwordResetTokenTtlMinutes = tokenTtlMinutes;

/**
 * Reset tokens are stored as SHA-256 hashes. The raw token only ever exists in
 * the emailed link, so a leaked database cannot be used to reset a password.
 */
const hashResetToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export type PasswordResetRequest = {
  user: { id: number; email: string };
  token: string;
  expiresAt: Date;
};

/**
 * Creates a single-use reset token for the given email address.
 *
 * Returns `null` when no account matches, so callers can respond identically
 * for known and unknown addresses and avoid leaking which emails are registered.
 */
export const createPasswordResetToken = async (
  email: string
): Promise<PasswordResetRequest | null> => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true }
  });

  if (!user) {
    return null;
  }

  // Drop tokens that can no longer be used, plus any earlier tokens for this
  // user, so only the most recent link works.
  await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }]
    }
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + tokenTtlMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashResetToken(token),
      userId: user.id,
      expiresAt
    }
  });

  return { user, token, expiresAt };
};

const findUsableResetToken = async (token: string) => {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return null;
  }

  const tokenHash = hashResetToken(normalizedToken);

  const storedToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      userId: true,
      expiresAt: true,
      usedAt: true
    }
  });

  if (!storedToken || storedToken.usedAt || storedToken.expiresAt <= new Date()) {
    return null;
  }

  // Constant-time comparison keeps the lookup from leaking hash prefixes.
  const isMatchingHash = timingSafeEqual(
    Buffer.from(storedToken.tokenHash),
    Buffer.from(tokenHash)
  );

  return isMatchingHash ? storedToken : null;
};

export const isPasswordResetTokenValid = async (token: string): Promise<boolean> =>
  Boolean(await findUsableResetToken(token));

export type ResetPasswordResult =
  | { status: "success" }
  | { status: "invalid_token" }
  | { status: "weak_password" };

/**
 * Applies a new password and burns the token so the link cannot be reused.
 */
export const resetPasswordWithToken = async (
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> => {
  const storedToken = await findUsableResetToken(token);

  if (!storedToken) {
    return { status: "invalid_token" };
  }

  if (newPassword.trim().length < minimumPasswordLength) {
    return { status: "weak_password" };
  }

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: storedToken.userId },
      data: { passwordHash: hashPassword(newPassword) }
    }),
    prisma.passwordResetToken.update({
      where: { id: storedToken.id },
      data: { usedAt: new Date() }
    }),
    // Any other outstanding link for this account is invalidated too.
    prisma.passwordResetToken.deleteMany({
      where: { userId: storedToken.userId, id: { not: storedToken.id } }
    })
  ]);

  return { status: "success" };
};
