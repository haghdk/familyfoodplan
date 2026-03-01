import { createHmac } from "crypto";

export type SessionPayload = {
  sub: number;
  email: string;
  role: "ADMIN" | "VIEWER";
  iat: number;
  exp: number;
};

const TOKEN_PART_SEPARATOR = ".";
const SECRET = process.env.AUTH_JWT_SECRET || "dev-admin-secret-change-me";
const EXPIRES_IN_SECONDS = 60 * 60 * 24;

const toBase64Url = (value: string): string =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

const createSignature = (value: string): string =>
  createHmac("sha256", SECRET)
    .update(value)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export const createSessionToken = (user: {
  id: number;
  email: string;
  role: "ADMIN" | "VIEWER";
}): string => {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: now,
      exp: now + EXPIRES_IN_SECONDS
    } satisfies SessionPayload)
  );

  const unsignedToken = `${header}${TOKEN_PART_SEPARATOR}${payload}`;
  const signature = createSignature(unsignedToken);

  return `${unsignedToken}${TOKEN_PART_SEPARATOR}${signature}`;
};

export const verifySessionToken = (token: string): SessionPayload | null => {
  const [header, payload, signature] = token.split(TOKEN_PART_SEPARATOR);

  if (!header || !payload || !signature) {
    return null;
  }

  const unsignedToken = `${header}${TOKEN_PART_SEPARATOR}${payload}`;
  const expectedSignature = createSignature(unsignedToken);

  if (signature !== expectedSignature) {
    return null;
  }

  const parsedPayload = JSON.parse(fromBase64Url(payload)) as SessionPayload;

  if (parsedPayload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsedPayload;
};

export const sessionMaxAgeSeconds = EXPIRES_IN_SECONDS;
