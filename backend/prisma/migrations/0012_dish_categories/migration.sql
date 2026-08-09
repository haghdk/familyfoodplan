-- Categories for the saved dishes — "Soups", "Pasta" — so a cookbook that has
-- grown past a screenful can be read a shelf at a time instead of as one long
-- alphabetical run.
--
-- A category is a row rather than an enum value: what a family cooks is not a
-- list anyone can write down in advance. The link on Dish is nullable and
-- clears on delete, so removing a category never takes its dishes with it.

-- CreateTable
CREATE TABLE "DishCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DishCategory_name_key" ON "DishCategory"("name");

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN "categoryId" INTEGER;

-- CreateIndex
CREATE INDEX "Dish_categoryId_idx" ON "Dish"("categoryId");

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DishCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
