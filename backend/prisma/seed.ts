import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/auth/password";

const prisma = new PrismaClient();

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

const seedAdminUser = async (): Promise<void> => {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the first admin user.");
  }

  const passwordHash = hashPassword(adminPassword);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash
    }
  });

  console.log(`Seeded admin user: ${adminEmail}`);
};

seedAdminUser()
  .catch((error: unknown) => {
    console.error("Failed to seed admin user", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
