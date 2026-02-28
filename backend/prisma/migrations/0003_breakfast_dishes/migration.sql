-- CreateTable
CREATE TABLE "BreakfastDish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "planDayId" INTEGER NOT NULL,
    "familyMemberId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakfastDish_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GroceryItem" ADD COLUMN "breakfastDishId" INTEGER;

-- CreateIndex
CREATE INDEX "BreakfastDish_planDayId_idx" ON "BreakfastDish"("planDayId");

-- CreateIndex
CREATE INDEX "BreakfastDish_familyMemberId_idx" ON "BreakfastDish"("familyMemberId");

-- CreateIndex
CREATE INDEX "GroceryItem_breakfastDishId_idx" ON "GroceryItem"("breakfastDishId");

-- AddForeignKey
ALTER TABLE "BreakfastDish" ADD CONSTRAINT "BreakfastDish_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakfastDish" ADD CONSTRAINT "BreakfastDish_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_breakfastDishId_fkey" FOREIGN KEY ("breakfastDishId") REFERENCES "BreakfastDish"("id") ON DELETE SET NULL ON UPDATE CASCADE;
