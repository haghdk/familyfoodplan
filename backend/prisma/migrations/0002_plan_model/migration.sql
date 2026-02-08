-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- Data migration: create a default plan for all legacy plan-day rows
INSERT INTO "Plan" ("name", "createdAt", "updatedAt")
VALUES ('Legacy Plan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- AlterTable
ALTER TABLE "PlanDay" ADD COLUMN "planId" INTEGER;

-- Backfill planId on existing rows
UPDATE "PlanDay"
SET "planId" = (SELECT "id" FROM "Plan" WHERE "name" = 'Legacy Plan' LIMIT 1)
WHERE "planId" IS NULL;

-- Make planId required
ALTER TABLE "PlanDay" ALTER COLUMN "planId" SET NOT NULL;

-- Replace old global unique index on date
DROP INDEX IF EXISTS "PlanDay_date_key";

-- Create scoped constraints/indexes
CREATE UNIQUE INDEX "PlanDay_planId_date_key" ON "PlanDay"("planId", "date");
CREATE INDEX "PlanDay_planId_idx" ON "PlanDay"("planId");

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
