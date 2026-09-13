-- Partial pick ups for grocery lines. A line for two cartons of milk can now be
-- half done: the shopper found one, the other is still missing, and the list has
-- to say so instead of forcing a choice between "untouched" and "bought".
ALTER TABLE "GroceryItem" ADD COLUMN "pickedUpQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Everything already ticked off was ticked off in full, so the new column starts
-- out agreeing with the flag the lists have been using until now.
UPDATE "GroceryItem" SET "pickedUpQuantity" = "quantity" WHERE "isChecked" = true;
