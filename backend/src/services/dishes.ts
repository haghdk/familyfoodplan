import { Prisma } from "../generated/prisma/client";
import { GroceryCategory } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { getNextGrocerySortOrder } from "./grocery";
import { mealLinkWhere, pantryMatchKey, takeFromPantry, type MealLink } from "./pantry";

export type { MealLink };

// Ingredients are read back in the order they were written down on the dish,
// falling back to insertion order for lines that share a position.
const dishIngredientOrderBy: Prisma.DishIngredientOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { id: "asc" }
];

/**
 * The single shape every dish endpoint answers with, so the list, the create
 * response and the update response can never drift apart.
 */
export const dishSelect = {
  id: true,
  name: true,
  notes: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      name: true
    }
  },
  ingredients: {
    orderBy: dishIngredientOrderBy,
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true
    }
  }
} satisfies Prisma.DishSelect;

export type DishIngredientInput = {
  name: string;
  quantity: number;
  unit: string | null;
};

export type ParsedDishCategoryId =
  | { status: "invalid"; message: string }
  | { status: "parsed"; categoryId: number | null };

/**
 * Reads the category off a request body. An absent field and an explicit `null`
 * both mean "no category", so a client that does not know about categories
 * keeps working and one that does can clear the field.
 */
export const parseDishCategoryId = (rawCategoryId: unknown): ParsedDishCategoryId => {
  if (rawCategoryId === undefined || rawCategoryId === null || rawCategoryId === "") {
    return { status: "parsed", categoryId: null };
  }

  const parsedCategoryId = Number(rawCategoryId);

  if (!Number.isInteger(parsedCategoryId)) {
    return { status: "invalid", message: "categoryId must be a whole number or null." };
  }

  return { status: "parsed", categoryId: parsedCategoryId };
};

/** Whether a category id names a category that exists. */
export const dishCategoryExists = async (categoryId: number) =>
  (await prisma.dishCategory.count({ where: { id: categoryId } })) > 0;

export type ParsedDishIngredients =
  | { status: "invalid"; message: string }
  | { status: "parsed"; ingredients: DishIngredientInput[] };

const normalizeQuantity = (quantity: unknown) =>
  typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

const normalizeUnit = (unit: unknown) =>
  typeof unit === "string" ? unit.trim() || null : null;

/**
 * Reads the ingredient lines off a request body. Blank lines are dropped rather
 * than rejected, because the dish form always keeps an empty row at the bottom
 * for the next ingredient.
 */
export const parseDishIngredients = (rawIngredients: unknown): ParsedDishIngredients => {
  if (rawIngredients === undefined || rawIngredients === null) {
    return { status: "parsed", ingredients: [] };
  }

  if (!Array.isArray(rawIngredients)) {
    return { status: "invalid", message: "ingredients must be an array." };
  }

  const ingredients: DishIngredientInput[] = [];

  for (const rawIngredient of rawIngredients) {
    if (typeof rawIngredient !== "object" || rawIngredient === null) {
      return { status: "invalid", message: "Each ingredient must be an object." };
    }

    const { name, quantity, unit } = rawIngredient as {
      name?: unknown;
      quantity?: unknown;
      unit?: unknown;
    };
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      continue;
    }

    ingredients.push({
      name: normalizedName,
      quantity: normalizeQuantity(quantity),
      unit: normalizeUnit(unit)
    });
  }

  return { status: "parsed", ingredients };
};

export const toIngredientCreateData = (ingredients: DishIngredientInput[]) =>
  ingredients.map((ingredient, position) => ({
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sortOrder: position
  }));

export type PantryPickup = {
  name: string;
  unit: string | null;
  /** How much of the ingredient came off the shelf. */
  quantity: number;
  /** True when the cabinets covered the whole amount and nothing was bought. */
  coversWholeIngredient: boolean;
};

export type AddDishIngredientsResult =
  | { status: "dish_not_found" }
  | { status: "no_ingredients" }
  | {
      status: "added";
      createdItems: GroceryItemWithMeals[];
      skippedCount: number;
      pantryPickups: PantryPickup[];
    };

const groceryItemInclude = {
  dinnerDish: { select: { id: true, name: true } },
  breakfastDish: { select: { id: true, name: true } },
  lunchDish: { select: { id: true, name: true } }
} satisfies Prisma.GroceryItemInclude;

type GroceryItemWithMeals = Prisma.GroceryItemGetPayload<{
  include: typeof groceryItemInclude;
}>;

/**
 * Copies a saved dish's ingredients onto a plan's grocery list, attached to the
 * planned meal they were added for — but takes whatever the kitchen cabinets
 * already hold off the shelf instead of onto the list.
 *
 * Two things keep a second press honest. Ingredients the meal already carries on
 * the list are skipped, and so are ingredients it has already claimed from the
 * pantry, which is what the allocation rows record. Without the second check a
 * repeat press would empty the cabinet all over again, since a covered
 * ingredient leaves no grocery item behind to recognise it by.
 *
 * The whole thing runs in one transaction: a failure half way through must not
 * leave the cabinets debited for shopping that was never written down.
 */
export const addDishIngredientsToGroceryList = async (params: {
  dishId: number;
  planDayId: number;
  planDayIds: number[];
  mealLink: MealLink;
}): Promise<AddDishIngredientsResult> => {
  const dish = await prisma.dish.findUnique({
    where: { id: params.dishId },
    select: dishSelect
  });

  if (!dish) {
    return { status: "dish_not_found" };
  }

  if (dish.ingredients.length === 0) {
    return { status: "no_ingredients" };
  }

  const mealWhere = mealLinkWhere(params.mealLink);

  const [existingItems, existingAllocations] = await Promise.all([
    prisma.groceryItem.findMany({
      where: { planDayId: { in: params.planDayIds }, ...mealWhere },
      select: { name: true, unit: true }
    }),
    prisma.pantryAllocation.findMany({
      where: mealWhere,
      select: { ingredientName: true, unit: true }
    })
  ]);

  const resolvedKeys = new Set([
    ...existingItems.map((existingItem) =>
      pantryMatchKey(existingItem.name, existingItem.unit)
    ),
    ...existingAllocations.map((allocation) =>
      pantryMatchKey(allocation.ingredientName, allocation.unit)
    )
  ]);

  const ingredientsToResolve = dish.ingredients.filter(
    (ingredient) => !resolvedKeys.has(pantryMatchKey(ingredient.name, ingredient.unit))
  );

  if (ingredientsToResolve.length === 0) {
    return {
      status: "added",
      createdItems: [],
      skippedCount: dish.ingredients.length,
      pantryPickups: []
    };
  }

  const nextSortOrder = await getNextGrocerySortOrder(params.planDayIds);

  const { createdItems, pantryPickups } = await prisma.$transaction(async (tx) => {
    const createdItems: GroceryItemWithMeals[] = [];
    const pantryPickups: PantryPickup[] = [];
    let sortOrder = nextSortOrder;

    for (const ingredient of ingredientsToResolve) {
      const takes = await takeFromPantry(tx, ingredient, ingredient.quantity);
      const takenQuantity = takes.reduce((total, take) => total + take.quantity, 0);

      for (const take of takes) {
        await tx.pantryAllocation.create({
          data: {
            ingredientName: ingredient.name,
            unit: ingredient.unit,
            quantity: take.quantity,
            // The row may already be gone if this take emptied it, and the
            // claim has to outlive it either way.
            pantryItemId: take.emptied ? null : take.pantryItemId,
            dinnerDishId: params.mealLink.dinnerDishId ?? null,
            breakfastDishId: params.mealLink.breakfastDishId ?? null,
            lunchDishId: params.mealLink.lunchDishId ?? null
          }
        });
      }

      const remainingToBuy = ingredient.quantity - takenQuantity;

      if (takenQuantity > 0) {
        pantryPickups.push({
          name: ingredient.name,
          unit: ingredient.unit,
          quantity: takenQuantity,
          coversWholeIngredient: remainingToBuy <= 0
        });
      }

      // Fully covered by the cabinets, so there is nothing to shop for.
      if (remainingToBuy <= 0) {
        continue;
      }

      createdItems.push(
        await tx.groceryItem.create({
          data: {
            name: ingredient.name,
            quantity: remainingToBuy,
            unit: ingredient.unit,
            category: GroceryCategory.INGREDIENT,
            sortOrder: sortOrder,
            planDayId: params.planDayId,
            dinnerDishId: params.mealLink.dinnerDishId ?? null,
            breakfastDishId: params.mealLink.breakfastDishId ?? null,
            lunchDishId: params.mealLink.lunchDishId ?? null
          },
          include: groceryItemInclude
        })
      );

      sortOrder += 1;
    }

    return { createdItems, pantryPickups };
  });

  return {
    status: "added",
    createdItems,
    skippedCount: dish.ingredients.length - ingredientsToResolve.length,
    pantryPickups
  };
};
