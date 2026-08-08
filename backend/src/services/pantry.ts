import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

type TransactionClient = Prisma.TransactionClient;

export const pantryItemSelect = {
  id: true,
  name: true,
  quantity: true,
  unit: true,
  expirationDate: true,
  notes: true
} satisfies Prisma.PantryItemSelect;

/**
 * How a cabinet item and a dish ingredient are recognised as the same thing:
 * the name and the unit, both trimmed and lower-cased.
 *
 * The unit has to match rather than being converted, because there is no honest
 * conversion between "1 can" and "400 g" without knowing the can. Two entries
 * that mean the same thing in different units are treated as different things,
 * which errs towards buying a spare rather than towards a missing ingredient at
 * six o'clock.
 */
export const pantryMatchKey = (name: string, unit: string | null | undefined) =>
  `${name.trim().toLowerCase()}::${unit?.trim().toLowerCase() ?? ""}`;

export type MealLink = {
  dinnerDishId?: number | null;
  breakfastDishId?: number | null;
  lunchDishId?: number | null;
};

/** The `where` fragment selecting the rows belonging to exactly one meal. */
export const mealLinkWhere = (mealLink: MealLink) => ({
  ...(typeof mealLink.dinnerDishId === "number"
    ? { dinnerDishId: mealLink.dinnerDishId }
    : {}),
  ...(typeof mealLink.breakfastDishId === "number"
    ? { breakfastDishId: mealLink.breakfastDishId }
    : {}),
  ...(typeof mealLink.lunchDishId === "number"
    ? { lunchDishId: mealLink.lunchDishId }
    : {})
});

export type PantryTake = {
  pantryItemId: number;
  quantity: number;
  /** True when the row was emptied and removed from the cabinet list. */
  emptied: boolean;
};

/**
 * Takes up to `requestedQuantity` of one ingredient out of the cabinets.
 *
 * Rows are drawn on soonest-expiry-first, which is the whole point of tracking
 * dates: the tin that is about to go off is the one this week's dinner should
 * use. Rows with no date are used last, since they are the ones in no hurry.
 * A row that reaches zero is deleted rather than left behind as an empty shelf
 * entry.
 *
 * Returns what was actually taken, which may be less than asked for — a partly
 * stocked cabinet still saves the shopper part of the trip.
 */
export const takeFromPantry = async (
  tx: TransactionClient,
  ingredient: { name: string; unit: string | null },
  requestedQuantity: number
): Promise<PantryTake[]> => {
  const candidateItems = await tx.pantryItem.findMany({
    where: { name: { equals: ingredient.name.trim(), mode: "insensitive" } },
    select: { id: true, name: true, quantity: true, unit: true, expirationDate: true }
  });

  const matchKey = pantryMatchKey(ingredient.name, ingredient.unit);
  const matchingItems = candidateItems
    .filter((item) => pantryMatchKey(item.name, item.unit) === matchKey)
    .sort((first, second) => {
      // Nulls last: a dated item is always used before an undated one.
      if (!first.expirationDate || !second.expirationDate) {
        return first.expirationDate ? -1 : second.expirationDate ? 1 : first.id - second.id;
      }

      return first.expirationDate.getTime() - second.expirationDate.getTime();
    });

  const takes: PantryTake[] = [];
  let remainingQuantity = requestedQuantity;

  for (const item of matchingItems) {
    if (remainingQuantity <= 0) {
      break;
    }

    const takenQuantity = Math.min(item.quantity, remainingQuantity);

    if (takenQuantity <= 0) {
      continue;
    }

    remainingQuantity -= takenQuantity;
    const remainingInItem = item.quantity - takenQuantity;

    if (remainingInItem <= 0) {
      await tx.pantryItem.delete({ where: { id: item.id } });
    } else {
      await tx.pantryItem.update({
        where: { id: item.id },
        data: { quantity: remainingInItem }
      });
    }

    takes.push({
      pantryItemId: item.id,
      quantity: takenQuantity,
      emptied: remainingInItem <= 0
    });
  }

  return takes;
};

export type PlanPantryMatch = {
  name: string;
  unit: string | null;
  /** How much the plan's dishes still ask for. */
  neededQuantity: number;
  /** How much of it is in the cabinets right now. */
  pantryQuantity: number;
  /** Whether the cabinets cover the whole amount the plan needs. */
  isFullyCovered: boolean;
  expirationDate: string | null;
  /** The meals asking for it, as "Dinner: Lasagne". */
  mealLabels: string[];
};

const formatDateKey = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;

const dishIngredientOrderBy: Prisma.DishIngredientOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { id: "asc" }
];

/**
 * Everything needed to decide what one planned meal still wants from the shops:
 * the recipe it was picked from, what it has already put on the list, and what
 * it has already taken off the shelf.
 */
const pantryMealSelect = {
  id: true,
  name: true,
  dish: {
    select: {
      ingredients: {
        orderBy: dishIngredientOrderBy,
        select: { name: true, quantity: true, unit: true }
      }
    }
  },
  groceryItems: { select: { name: true, unit: true } },
  pantryAllocations: { select: { ingredientName: true, unit: true } }
} satisfies Prisma.DinnerDishSelect &
  Prisma.BreakfastDishSelect &
  Prisma.LunchDishSelect;

const planDayPantrySelect = {
  dinnerDish: { select: pantryMealSelect },
  breakfastDishes: { select: pantryMealSelect, orderBy: { id: "asc" } },
  lunchDishes: { select: pantryMealSelect, orderBy: { id: "asc" } }
} satisfies Prisma.PlanDaySelect;

type MealWithDish = Prisma.DinnerDishGetPayload<{ select: typeof pantryMealSelect }>;

/**
 * What this plan could take out of the cabinets: every ingredient of every meal
 * that was picked from a saved dish, matched against what is on the shelves.
 *
 * Ingredients the meal has already resolved — copied onto the grocery list, or
 * already taken from the pantry — are left out, so the panel on the plan screen
 * shrinks as the week is dealt with rather than repeating itself.
 */
export const getPlanPantryMatches = async (
  planId: number
): Promise<PlanPantryMatch[]> => {
  const planDays = await prisma.planDay.findMany({
    where: { planId },
    orderBy: { date: "asc" },
    select: planDayPantrySelect
  });

  const meals: Array<{ meal: MealWithDish; mealTypeLabel: string }> = [];

  for (const planDay of planDays) {
    if (planDay.dinnerDish) {
      meals.push({ meal: planDay.dinnerDish, mealTypeLabel: "Dinner" });
    }

    for (const breakfastDish of planDay.breakfastDishes) {
      meals.push({ meal: breakfastDish, mealTypeLabel: "Breakfast" });
    }

    for (const lunchDish of planDay.lunchDishes) {
      meals.push({ meal: lunchDish, mealTypeLabel: "Lunch" });
    }
  }

  const neededByKey = new Map<
    string,
    { name: string; unit: string | null; quantity: number; mealLabels: string[] }
  >();

  for (const { meal, mealTypeLabel } of meals) {
    if (!meal.dish) {
      continue;
    }

    const resolvedKeys = new Set([
      ...meal.groceryItems.map((groceryItem) =>
        pantryMatchKey(groceryItem.name, groceryItem.unit)
      ),
      ...meal.pantryAllocations.map((allocation) =>
        pantryMatchKey(allocation.ingredientName, allocation.unit)
      )
    ]);

    for (const ingredient of meal.dish.ingredients) {
      const key = pantryMatchKey(ingredient.name, ingredient.unit);

      if (resolvedKeys.has(key)) {
        continue;
      }

      const mealLabel = `${mealTypeLabel}: ${meal.name}`;
      const current = neededByKey.get(key);

      if (!current) {
        neededByKey.set(key, {
          name: ingredient.name,
          unit: ingredient.unit,
          quantity: ingredient.quantity,
          mealLabels: [mealLabel]
        });
        continue;
      }

      current.quantity += ingredient.quantity;

      if (!current.mealLabels.includes(mealLabel)) {
        current.mealLabels.push(mealLabel);
      }
    }
  }

  if (neededByKey.size === 0) {
    return [];
  }

  const pantryItems = await prisma.pantryItem.findMany({
    select: { name: true, quantity: true, unit: true, expirationDate: true }
  });

  const stockByKey = new Map<string, { quantity: number; expirationDate: Date | null }>();

  for (const pantryItem of pantryItems) {
    const key = pantryMatchKey(pantryItem.name, pantryItem.unit);
    const current = stockByKey.get(key);

    if (!current) {
      stockByKey.set(key, {
        quantity: pantryItem.quantity,
        expirationDate: pantryItem.expirationDate
      });
      continue;
    }

    current.quantity += pantryItem.quantity;

    // Show the date that matters most: the one running out first.
    if (
      pantryItem.expirationDate &&
      (!current.expirationDate || pantryItem.expirationDate < current.expirationDate)
    ) {
      current.expirationDate = pantryItem.expirationDate;
    }
  }

  const matches: PlanPantryMatch[] = [];

  for (const [key, needed] of neededByKey) {
    const stock = stockByKey.get(key);

    if (!stock || stock.quantity <= 0) {
      continue;
    }

    matches.push({
      name: needed.name,
      unit: needed.unit,
      neededQuantity: needed.quantity,
      pantryQuantity: stock.quantity,
      isFullyCovered: stock.quantity >= needed.quantity,
      expirationDate: formatDateKey(stock.expirationDate),
      mealLabels: needed.mealLabels
    });
  }

  return matches.sort((first, second) => first.name.localeCompare(second.name));
};

export type ExpiringPantryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string | null;
  expirationDate: string;
  /** Negative once the date has passed. */
  daysUntilExpiration: number;
};

/**
 * Everything with a date on or before `withinDays` from `today`, including
 * anything already past it — an expired tin still on the shelf is exactly what
 * this list is for.
 */
export const getExpiringPantryItems = async (
  todayDayKey: string,
  withinDays: number
): Promise<ExpiringPantryItem[]> => {
  const today = new Date(`${todayDayKey}T00:00:00.000Z`);
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() + withinDays);

  const pantryItems = await prisma.pantryItem.findMany({
    where: { expirationDate: { not: null, lte: cutoff } },
    orderBy: [{ expirationDate: "asc" }, { name: "asc" }],
    select: { id: true, name: true, quantity: true, unit: true, expirationDate: true }
  });

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return pantryItems.flatMap((pantryItem) =>
    pantryItem.expirationDate
      ? [
          {
            id: pantryItem.id,
            name: pantryItem.name,
            quantity: pantryItem.quantity,
            unit: pantryItem.unit,
            expirationDate: pantryItem.expirationDate.toISOString().slice(0, 10),
            daysUntilExpiration: Math.round(
              (pantryItem.expirationDate.getTime() - today.getTime()) / millisecondsPerDay
            )
          }
        ]
      : []
  );
};
