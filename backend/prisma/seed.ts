import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";

import { hashPassword } from "../src/auth/password";

const adapter = new PrismaPg(
  new Pool({
    connectionString: process.env.DATABASE_URL
  })
);

const prisma = new PrismaClient({ adapter });

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

const DEFAULT_PLAN_NAME = "Legacy Plan";

const seedDefaultPlan = async (): Promise<void> => {
  await prisma.plan.upsert({
    where: { name: DEFAULT_PLAN_NAME },
    update: {},
    create: { name: DEFAULT_PLAN_NAME }
  });

  console.log(`Seeded default plan: ${DEFAULT_PLAN_NAME}`);
};

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

seedDefaultPlan()
  .then(seedAdminUser)
  .catch((error: unknown) => {
    console.error("Failed to seed admin user", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
