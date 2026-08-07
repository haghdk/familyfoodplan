import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { readPlanDayMeals } from "./planDayMeals";

export const swappableMealTypes = ["breakfast", "lunch", "dinner"] as const;

export type SwappableMealType = (typeof swappableMealTypes)[number];

export const isSwappableMealType = (value: unknown): value is SwappableMealType =>
  swappableMealTypes.some((mealType) => mealType === value);

type TransactionClient = Prisma.TransactionClient;

type RowMealType = Extract<SwappableMealType, "breakfast" | "lunch">;

export type SwapPlanDayMealsResult =
  | { status: "plan_days_not_found"; missingDayKeys: string[] }
  | { status: "swapped"; planDays: Awaited<ReturnType<typeof readPlanDayMeals>> };

const readMealRowIds = async (
  tx: TransactionClient,
  mealType: RowMealType,
  planDayId: number
) => {
  const mealRows =
    mealType === "breakfast"
      ? await tx.breakfastDish.findMany({ where: { planDayId }, select: { id: true } })
      : await tx.lunchDish.findMany({ where: { planDayId }, select: { id: true } });

  return mealRows.map((mealRow) => mealRow.id);
};

// Ingredients added for a dish belong to that dish wherever it ends up, so the
// grocery rows are carried over to the new day together with the meal.
const moveMealRows = async (
  tx: TransactionClient,
  mealType: RowMealType,
  mealRowIds: number[],
  planDayId: number
) => {
  if (mealRowIds.length === 0) {
    return;
  }

  if (mealType === "breakfast") {
    await tx.breakfastDish.updateMany({
      where: { id: { in: mealRowIds } },
      data: { planDayId }
    });
    await tx.groceryItem.updateMany({
      where: { breakfastDishId: { in: mealRowIds } },
      data: { planDayId }
    });
    return;
  }

  await tx.lunchDish.updateMany({
    where: { id: { in: mealRowIds } },
    data: { planDayId }
  });
  await tx.groceryItem.updateMany({
    where: { lunchDishId: { in: mealRowIds } },
    data: { planDayId }
  });
};

// Breakfast and lunch are repeatable rows, so both days hand their whole set
// over to the other day. Reading the two sets up front matters: once the first
// set has moved, "the rows on this day" no longer means what it did.
const swapMealRows = async (
  tx: TransactionClient,
  mealType: RowMealType,
  sourcePlanDayId: number,
  targetPlanDayId: number
) => {
  const sourceMealRowIds = await readMealRowIds(tx, mealType, sourcePlanDayId);
  const targetMealRowIds = await readMealRowIds(tx, mealType, targetPlanDayId);

  await moveMealRows(tx, mealType, sourceMealRowIds, targetPlanDayId);
  await moveMealRows(tx, mealType, targetMealRowIds, sourcePlanDayId);
};

const swapDinners = async (
  tx: TransactionClient,
  sourcePlanDayId: number,
  targetPlanDayId: number
) => {
  const sourceDinner = await tx.dinnerDish.findUnique({
    where: { planDayId: sourcePlanDayId }
  });
  const targetDinner = await tx.dinnerDish.findUnique({
    where: { planDayId: targetPlanDayId }
  });

  if (!sourceDinner && !targetDinner) {
    return;
  }

  // Only one of the days has a dinner, so it simply moves to the empty day.
  if (!sourceDinner || !targetDinner) {
    const dinnerToMove = sourceDinner ?? targetDinner;
    const destinationPlanDayId = sourceDinner ? targetPlanDayId : sourcePlanDayId;

    if (!dinnerToMove) {
      return;
    }

    await tx.dinnerDish.update({
      where: { id: dinnerToMove.id },
      data: { planDayId: destinationPlanDayId }
    });
    await tx.groceryItem.updateMany({
      where: { dinnerDishId: dinnerToMove.id },
      data: { planDayId: destinationPlanDayId }
    });
    return;
  }

  // A day holds at most one dinner, and PostgreSQL enforces that per row rather
  // than at the end of the transaction, so the two rows cannot trade day ids
  // without one of them briefly colliding with the other. What the dishes are
  // made of is traded instead: each day ends up with the other day's dinner, and
  // the ingredients are re-pointed so they follow the dish they were added for
  // rather than staying behind with the row.
  const sourceGroceryItems = await tx.groceryItem.findMany({
    where: { dinnerDishId: sourceDinner.id },
    select: { id: true }
  });
  const targetGroceryItems = await tx.groceryItem.findMany({
    where: { dinnerDishId: targetDinner.id },
    select: { id: true }
  });

  await tx.dinnerDish.update({
    where: { id: sourceDinner.id },
    data: {
      name: targetDinner.name,
      notes: targetDinner.notes,
      dishId: targetDinner.dishId
    }
  });
  await tx.dinnerDish.update({
    where: { id: targetDinner.id },
    data: {
      name: sourceDinner.name,
      notes: sourceDinner.notes,
      dishId: sourceDinner.dishId
    }
  });

  await tx.groceryItem.updateMany({
    where: { id: { in: sourceGroceryItems.map((groceryItem) => groceryItem.id) } },
    data: { dinnerDishId: targetDinner.id, planDayId: targetPlanDayId }
  });
  await tx.groceryItem.updateMany({
    where: { id: { in: targetGroceryItems.map((groceryItem) => groceryItem.id) } },
    data: { dinnerDishId: sourceDinner.id, planDayId: sourcePlanDayId }
  });
};

/**
 * Trades one meal of the day between two days of the same plan — Tuesday's
 * dinner for Monday's, say, leaving both days' breakfasts and lunches exactly
 * where they were. A day the meal is missing from is a valid partner: the meal
 * then moves across instead of being exchanged.
 */
export const swapPlanDayMeals = async (params: {
  planId: number;
  mealType: SwappableMealType;
  sourceDayDate: Date;
  targetDayDate: Date;
  sourceDayKey: string;
  targetDayKey: string;
}): Promise<SwapPlanDayMealsResult> => {
  const planDays = await prisma.planDay.findMany({
    where: {
      planId: params.planId,
      date: { in: [params.sourceDayDate, params.targetDayDate] }
    },
    select: { id: true, date: true }
  });

  const findPlanDayId = (dayDate: Date) =>
    planDays.find((planDay) => planDay.date.getTime() === dayDate.getTime())?.id;

  const sourcePlanDayId = findPlanDayId(params.sourceDayDate);
  const targetPlanDayId = findPlanDayId(params.targetDayDate);

  if (!sourcePlanDayId || !targetPlanDayId) {
    return {
      status: "plan_days_not_found",
      missingDayKeys: [
        ...(sourcePlanDayId ? [] : [params.sourceDayKey]),
        ...(targetPlanDayId ? [] : [params.targetDayKey])
      ]
    };
  }

  await prisma.$transaction(async (tx) => {
    if (params.mealType === "dinner") {
      await swapDinners(tx, sourcePlanDayId, targetPlanDayId);
      return;
    }

    await swapMealRows(tx, params.mealType, sourcePlanDayId, targetPlanDayId);
  });

  return {
    status: "swapped",
    planDays: await readPlanDayMeals([sourcePlanDayId, targetPlanDayId])
  };
};
