-- Manual shopping order for grocery items, maintained by drag-to-reorder.
-- The order is plan wide, so items belonging to different plan days share one
-- sequence and can be arranged in the order the shopper walks the store.
ALTER TABLE "GroceryItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Seed the manual order from the previous implicit ordering (category, then
-- name) so existing lists keep looking the same until someone reorders them.
WITH "ordered_grocery_items" AS (
    SELECT
        "GroceryItem"."id" AS "itemId",
        ROW_NUMBER() OVER (
            PARTITION BY "PlanDay"."planId"
            ORDER BY
                "GroceryItem"."category",
                "GroceryItem"."name",
                "GroceryItem"."createdAt",
                "GroceryItem"."id"
        ) AS "position"
    FROM "GroceryItem"
    INNER JOIN "PlanDay" ON "PlanDay"."id" = "GroceryItem"."planDayId"
)
UPDATE "GroceryItem"
SET "sortOrder" = "ordered_grocery_items"."position"
FROM "ordered_grocery_items"
WHERE "GroceryItem"."id" = "ordered_grocery_items"."itemId";

CREATE INDEX "GroceryItem_planDayId_sortOrder_idx" ON "GroceryItem"("planDayId", "sortOrder");
