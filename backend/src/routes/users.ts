import { Router } from "express";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../auth/password";
import { requireAdminAuth } from "../middleware/auth";

const usersRouter = Router();

usersRouter.use(requireAdminAuth);

usersRouter.get("/api/users", async (_request, response) => {
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

usersRouter.post("/api/users", async (request, response) => {
  const { email, password, role } = request.body as {
    email?: string;
    password?: string;
    role?: "ADMIN" | "VIEWER";
  };

  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail || !password) {
    response.status(400).json({ message: "Email and password are required." });
    return;
  }

  if (role !== "ADMIN" && role !== "VIEWER") {
    response.status(400).json({ message: "Role must be ADMIN or VIEWER." });
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
    response.status(409).json({ message: "A user with that email already exists." });
  }
});

usersRouter.put("/api/users/:id", async (request, response) => {
  const userId = Number(request.params.id);

  if (Number.isNaN(userId)) {
    response.status(400).json({ message: "Invalid user id." });
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
      response.status(400).json({ message: "Email cannot be empty." });
      return;
    }

    updateData.email = normalizedEmail;
  }

  if (typeof password === "string") {
    if (!password.trim()) {
      response.status(400).json({ message: "Password cannot be empty." });
      return;
    }

    updateData.passwordHash = hashPassword(password);
  }

  if (role !== undefined) {
    if (role !== "ADMIN" && role !== "VIEWER") {
      response.status(400).json({ message: "Role must be ADMIN or VIEWER." });
      return;
    }

    updateData.role = role;
  }

  if (Object.keys(updateData).length === 0) {
    response.status(400).json({ message: "No fields provided to update." });
    return;
  }

  const userCount = await prisma.adminUser.count();
  const existingUser = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!existingUser) {
    response.status(404).json({ message: "User not found." });
    return;
  }

  if (
    existingUser.role === "ADMIN" &&
    updateData.role === "VIEWER" &&
    userCount === 1
  ) {
    response.status(400).json({ message: "Cannot demote the last admin user." });
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
    response.status(409).json({ message: "Could not update user. Email may already exist." });
  }
});

usersRouter.delete("/api/users/:id", async (request, response) => {
  const userId = Number(request.params.id);

  if (Number.isNaN(userId)) {
    response.status(400).json({ message: "Invalid user id." });
    return;
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!user) {
    response.status(404).json({ message: "User not found." });
    return;
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.adminUser.count({
      where: { role: "ADMIN" }
    });

    if (adminCount <= 1) {
      response.status(400).json({ message: "Cannot delete the last admin user." });
      return;
    }
  }

  await prisma.adminUser.delete({ where: { id: userId } });

  response.status(204).send();
});

export default usersRouter;
