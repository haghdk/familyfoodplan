-- CreateEnum
CREATE TYPE "GroceryCategory" AS ENUM ('GENERAL', 'INGREDIENT');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryShareToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "planDayId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DinnerDish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "planDayId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DinnerDish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchDish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "planDayId" INTEGER NOT NULL,
    "familyMemberId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LunchDish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "category" "GroceryCategory" NOT NULL DEFAULT 'GENERAL',
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "planDayId" INTEGER NOT NULL,
    "dinnerDishId" INTEGER,
    "lunchDishId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_date_key" ON "PlanDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryShareToken_token_key" ON "GroceryShareToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryShareToken_planDayId_key" ON "GroceryShareToken"("planDayId");

-- CreateIndex
CREATE UNIQUE INDEX "DinnerDish_planDayId_key" ON "DinnerDish"("planDayId");

-- CreateIndex
CREATE INDEX "LunchDish_planDayId_idx" ON "LunchDish"("planDayId");

-- CreateIndex
CREATE INDEX "LunchDish_familyMemberId_idx" ON "LunchDish"("familyMemberId");

-- CreateIndex
CREATE INDEX "GroceryItem_planDayId_idx" ON "GroceryItem"("planDayId");

-- CreateIndex
CREATE INDEX "GroceryItem_dinnerDishId_idx" ON "GroceryItem"("dinnerDishId");

-- CreateIndex
CREATE INDEX "GroceryItem_lunchDishId_idx" ON "GroceryItem"("lunchDishId");

-- AddForeignKey
ALTER TABLE "GroceryShareToken" ADD CONSTRAINT "GroceryShareToken_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DinnerDish" ADD CONSTRAINT "DinnerDish_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchDish" ADD CONSTRAINT "LunchDish_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchDish" ADD CONSTRAINT "LunchDish_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_dinnerDishId_fkey" FOREIGN KEY ("dinnerDishId") REFERENCES "DinnerDish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_lunchDishId_fkey" FOREIGN KEY ("lunchDishId") REFERENCES "LunchDish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

