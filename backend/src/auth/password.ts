import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const HASH_SEPARATOR = ":";

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");

  return `${salt}${HASH_SEPARATOR}${derivedKey}`;
};

export const verifyPassword = (
  password: string,
  storedPasswordHash: string
): boolean => {
  const [salt, expectedKey] = storedPasswordHash.split(HASH_SEPARATOR);

  if (!salt || !expectedKey) {
    return false;
  }

  const providedKey = scryptSync(password, salt, 64).toString("hex");

  return timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
};
