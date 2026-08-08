import { Router } from "express";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../auth/password";
import { requireAdminAuth } from "../middleware/auth";
import { requestLocale, translate } from "../i18n";

const usersRouter = Router();

// The admin guard is attached per route rather than with a path-less
// `router.use(...)`. Every router here is mounted at the application root, so a
// path-less guard runs on *every* request that reaches this router — including
// requests meant for routers registered after it, which it then rejects before
// they are ever seen. That is what once made the whole API admin-only for
// viewers. Per-route guards cannot leak onto another router's paths.

usersRouter.get("/api/users", requireAdminAuth, async (_request, response) => {
  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      id: "asc"
    }
  });

  response.status(200).json({ users });
});

usersRouter.post("/api/users", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
  const { email, password, role } = request.body as {
    email?: string;
    password?: string;
    role?: "ADMIN" | "VIEWER";
  };

  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail || !password) {
    response
      .status(400)
      .json({ message: translate(locale, "users.credentialsRequired") });
    return;
  }

  if (role !== "ADMIN" && role !== "VIEWER") {
    response.status(400).json({ message: translate(locale, "users.invalidRole") });
    return;
  }

  try {
    const user = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        role
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    response.status(201).json({ user });
  } catch (_error) {
    response.status(409).json({ message: translate(locale, "users.emailTaken") });
  }
});

usersRouter.put("/api/users/:id", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
  const userId = Number(request.params.id);

  if (Number.isNaN(userId)) {
    response.status(400).json({ message: translate(locale, "users.invalidId") });
    return;
  }

  const { email, password, role } = request.body as {
    email?: string;
    password?: string;
    role?: "ADMIN" | "VIEWER";
  };

  const updateData: {
    email?: string;
    passwordHash?: string;
    role?: "ADMIN" | "VIEWER";
  } = {};

  if (typeof email === "string") {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      response.status(400).json({ message: translate(locale, "users.emailEmpty") });
      return;
    }

    updateData.email = normalizedEmail;
  }

  if (typeof password === "string") {
    if (!password.trim()) {
      response.status(400).json({ message: translate(locale, "users.passwordEmpty") });
      return;
    }

    updateData.passwordHash = hashPassword(password);
  }

  if (role !== undefined) {
    if (role !== "ADMIN" && role !== "VIEWER") {
      response.status(400).json({ message: translate(locale, "users.invalidRole") });
      return;
    }

    updateData.role = role;
  }

  if (Object.keys(updateData).length === 0) {
    response.status(400).json({ message: translate(locale, "users.noFieldsToUpdate") });
    return;
  }

  const userCount = await prisma.adminUser.count();
  const existingUser = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!existingUser) {
    response.status(404).json({ message: translate(locale, "users.notFound") });
    return;
  }

  if (
    existingUser.role === "ADMIN" &&
    updateData.role === "VIEWER" &&
    userCount === 1
  ) {
    response.status(400).json({ message: translate(locale, "users.lastAdminDemote") });
    return;
  }

  try {
    const user = await prisma.adminUser.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    response.status(200).json({ user });
  } catch (_error) {
    response.status(409).json({ message: translate(locale, "users.updateFailed") });
  }
});

usersRouter.delete("/api/users/:id", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
  const userId = Number(request.params.id);

  if (Number.isNaN(userId)) {
    response.status(400).json({ message: translate(locale, "users.invalidId") });
    return;
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!user) {
    response.status(404).json({ message: translate(locale, "users.notFound") });
    return;
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.adminUser.count({
      where: { role: "ADMIN" }
    });

    if (adminCount <= 1) {
      response.status(400).json({ message: translate(locale, "users.lastAdminDelete") });
      return;
    }
  }

  await prisma.adminUser.delete({ where: { id: userId } });

  response.status(204).send();
});

export default usersRouter;
