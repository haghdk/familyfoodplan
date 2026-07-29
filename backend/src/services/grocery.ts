import { GroceryCategory } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

// Grocery items are always read in the manual shopping order the user arranged
// by dragging list rows, falling back to insertion order for equal positions.
export const groceryItemOrderBy: Prisma.GroceryItemOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { id: "asc" }
];

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
    orderBy: groceryItemOrderBy
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

// New items are appended to the end of the manual order, so adding items works
// exactly like before and the shopper decides afterwards where they belong.
export const getNextGrocerySortOrder = async (planDayIds: number[]) => {
  if (planDayIds.length === 0) {
    return 0;
  }

  const sortOrderAggregate = await prisma.groceryItem.aggregate({
    where: { planDayId: { in: planDayIds } },
    _max: { sortOrder: true }
  });

  return (sortOrderAggregate._max.sortOrder ?? -1) + 1;
};

export type ReorderGroceryItemsResult =
  | { status: "unknown_items"; unknownItemIds: number[] }
  | { status: "reordered"; orderedItemIds: number[] };

// Rewrites the manual order for a plan. Item ids that are left out of the
// request keep their relative order and are appended after the reordered ones,
// which keeps concurrent edits (a new item added while dragging) from
// disappearing off the list.
export const reorderGroceryItems = async (
  planDayIds: number[],
  requestedItemIds: number[]
): Promise<ReorderGroceryItemsResult> => {
  const planItems = await prisma.groceryItem.findMany({
    where: { planDayId: { in: planDayIds } },
    select: { id: true },
    orderBy: groceryItemOrderBy
  });

  const planItemIds = new Set(planItems.map((planItem) => planItem.id));
  const unknownItemIds = requestedItemIds.filter((itemId) => !planItemIds.has(itemId));

  if (unknownItemIds.length > 0) {
    return { status: "unknown_items", unknownItemIds };
  }

  const orderedItemIds: number[] = [];
  const placedItemIds = new Set<number>();

  for (const itemId of requestedItemIds) {
    if (placedItemIds.has(itemId)) {
      continue;
    }

    placedItemIds.add(itemId);
    orderedItemIds.push(itemId);
  }

  for (const planItem of planItems) {
    if (placedItemIds.has(planItem.id)) {
      continue;
    }

    orderedItemIds.push(planItem.id);
  }

  await prisma.$transaction(
    orderedItemIds.map((itemId, position) =>
      prisma.groceryItem.update({
        where: { id: itemId },
        data: { sortOrder: position }
      })
    )
  );

  return { status: "reordered", orderedItemIds };
};
