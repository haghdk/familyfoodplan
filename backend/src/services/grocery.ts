import { GroceryCategory } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";

export type MergedGroceryItem = {
  key: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: GroceryCategory;
  sourceLabels: string[];
  itemIds: number[];
};

const normalizeKeyPart = (value: string | null | undefined) =>
  value?.trim().toLowerCase() || "";

export const getMergedGroceryItemsByPlanDays = async (
  planDayIds: number[]
): Promise<MergedGroceryItem[]> => {
  if (planDayIds.length === 0) {
    return [];
  }

  const groceryItems = await prisma.groceryItem.findMany({
    where: { planDayId: { in: planDayIds } },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      breakfastDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }]
  });

  const mergedMap = new Map<string, MergedGroceryItem>();

  for (const groceryItem of groceryItems) {
    const mergeKey = [
      normalizeKeyPart(groceryItem.name),
      normalizeKeyPart(groceryItem.unit),
      groceryItem.category
    ].join("::");

    const sourceLabel = groceryItem.dinnerDish
      ? `Dinner: ${groceryItem.dinnerDish.name}`
      : groceryItem.breakfastDish
        ? `Breakfast: ${groceryItem.breakfastDish.name}`
        : groceryItem.lunchDish
          ? `Lunch: ${groceryItem.lunchDish.name}`
          : "General";

    const currentMerged = mergedMap.get(mergeKey);

    if (!currentMerged) {
      mergedMap.set(mergeKey, {
        key: mergeKey,
        name: groceryItem.name,
        quantity: groceryItem.quantity,
        unit: groceryItem.unit,
        category: groceryItem.category,
        sourceLabels: [sourceLabel],
        itemIds: [groceryItem.id]
      });
      continue;
    }

    currentMerged.quantity += groceryItem.quantity;
    currentMerged.itemIds.push(groceryItem.id);

    if (!currentMerged.sourceLabels.includes(sourceLabel)) {
      currentMerged.sourceLabels.push(sourceLabel);
    }
  }

  return Array.from(mergedMap.values());
};


export const getMergedGroceryItemsByPlanDay = async (
  planDayId: number
): Promise<MergedGroceryItem[]> => getMergedGroceryItemsByPlanDays([planDayId]);
