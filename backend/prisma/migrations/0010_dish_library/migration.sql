-- Saved dishes: a dish is stored once with its ingredients, so planning it on a
-- day is a pick from a list rather than retyping the recipe.

-- CreateTable
CREATE TABLE "Dish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dishId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dish_name_key" ON "Dish"("name");

-- CreateIndex
CREATE INDEX "DishIngredient_dishId_idx" ON "DishIngredient"("dishId");

-- CreateIndex
CREATE INDEX "DishIngredient_dishId_sortOrder_idx" ON "DishIngredient"("dishId", "sortOrder");

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A planned meal remembers the saved dish it was picked from, which is what
-- lets the plan offer "add its ingredients to the grocery list". Deleting a
-- saved dish clears the link instead of removing the planned meal.

-- AlterTable
ALTER TABLE "DinnerDish" ADD COLUMN "dishId" INTEGER;

-- AlterTable
ALTER TABLE "BreakfastDish" ADD COLUMN "dishId" INTEGER;

-- AlterTable
ALTER TABLE "LunchDish" ADD COLUMN "dishId" INTEGER;

-- CreateIndex
CREATE INDEX "DinnerDish_dishId_idx" ON "DinnerDish"("dishId");

-- CreateIndex
CREATE INDEX "BreakfastDish_dishId_idx" ON "BreakfastDish"("dishId");

-- CreateIndex
CREATE INDEX "LunchDish_dishId_idx" ON "LunchDish"("dishId");

-- AddForeignKey
ALTER TABLE "DinnerDish" ADD CONSTRAINT "DinnerDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakfastDish" ADD CONSTRAINT "BreakfastDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchDish" ADD CONSTRAINT "LunchDish_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE SET NULL ON UPDATE CASCADE;
