import { prisma } from "../lib/prisma";
import { verifyPassword } from "./password";

export type LoginInput = {
  email: string;
  password: string;
};

export const validateAdminLogin = async ({
  email,
  password
}: LoginInput): Promise<{ id: number; email: string } | null> => {
  const adminUser = await prisma.adminUser.findUnique({
    where: {
      email: email.toLowerCase().trim()
    }
  });

  if (!adminUser) {
    return null;
  }

  const isValidPassword = verifyPassword(password, adminUser.passwordHash);

  if (!isValidPassword) {
    return null;
  }

  return {
    id: adminUser.id,
    email: adminUser.email
  };
};
