-- The pantry: what is already in the kitchen cabinets, so a dish's ingredients
-- can be taken off the shelf instead of onto the shopping list, and so nothing
-- quietly expires at the back of a cupboard.

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "expirationDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryAllocation" (
    "id" SERIAL NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pantryItemId" INTEGER,
    "dinnerDishId" INTEGER,
    "breakfastDishId" INTEGER,
    "lunchDishId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryExpiryLog" (
    "id" SERIAL NOT NULL,
    "dayKey" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryExpiryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryItem_expirationDate_idx" ON "PantryItem"("expirationDate");

-- CreateIndex
CREATE INDEX "PantryAllocation_pantryItemId_idx" ON "PantryAllocation"("pantryItemId");

-- CreateIndex
CREATE INDEX "PantryAllocation_dinnerDishId_idx" ON "PantryAllocation"("dinnerDishId");

-- CreateIndex
CREATE INDEX "PantryAllocation_breakfastDishId_idx" ON "PantryAllocation"("breakfastDishId");

-- CreateIndex
CREATE INDEX "PantryAllocation_lunchDishId_idx" ON "PantryAllocation"("lunchDishId");

-- CreateIndex
CREATE UNIQUE INDEX "PantryExpiryLog_dayKey_key" ON "PantryExpiryLog"("dayKey");

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_pantryItemId_fkey" FOREIGN KEY ("pantryItemId") REFERENCES "PantryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_dinnerDishId_fkey" FOREIGN KEY ("dinnerDishId") REFERENCES "DinnerDish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_breakfastDishId_fkey" FOREIGN KEY ("breakfastDishId") REFERENCES "BreakfastDish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_lunchDishId_fkey" FOREIGN KEY ("lunchDishId") REFERENCES "LunchDish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Opt-in for the daily "going off soon" notification, kept apart from the
-- dinner reminder so either can be switched on without the other.
ALTER TABLE "UserSettings" ADD COLUMN "pantryExpiryReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
