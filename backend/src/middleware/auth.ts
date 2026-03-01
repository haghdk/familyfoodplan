import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifySessionToken } from "../auth/session";

const extractBearerToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.replace("Bearer ", "").trim();
};

const extractCookieToken = (cookieHeader?: string): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith("admin_session="));

  if (!sessionCookie) {
    return null;
  }

  return sessionCookie.replace("admin_session=", "");
};

export const requireAuth = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  const bearerToken = extractBearerToken(request.headers.authorization);
  const cookieToken = extractCookieToken(request.headers.cookie);
  const token = bearerToken || cookieToken;

  if (!token) {
    response.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    response.status(401).json({ message: "Unauthorized" });
    return;
  }

  const user = await prisma.adminUser.findUnique({
    where: {
      id: payload.sub
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  if (!user) {
    response.status(401).json({ message: "Unauthorized" });
    return;
  }

  response.locals.user = user;
  next();
};

export const requireAdminAuth = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  await requireAuth(request, response, () => {
    const user = response.locals.user as { role: "ADMIN" | "VIEWER" };

    if (user.role !== "ADMIN") {
      response.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  });
};
