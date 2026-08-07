import { Prisma } from "../generated/prisma/client";
import { GroceryCategory } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { getNextGrocerySortOrder } from "./grocery";

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

export type MealLink = {
  dinnerDishId?: number | null;
  breakfastDishId?: number | null;
  lunchDishId?: number | null;
};

export type AddDishIngredientsResult =
  | { status: "dish_not_found" }
  | { status: "no_ingredients" }
  | {
      status: "added";
      createdItems: Awaited<ReturnType<typeof createGroceryItemsForDish>>;
      skippedCount: number;
    };

const groceryItemInclude = {
  dinnerDish: { select: { id: true, name: true } },
  breakfastDish: { select: { id: true, name: true } },
  lunchDish: { select: { id: true, name: true } }
} satisfies Prisma.GroceryItemInclude;

const createGroceryItemsForDish = async (
  itemsToCreate: Array<Prisma.GroceryItemUncheckedCreateInput>
) => {
  const createdItems = [];

  for (const itemToCreate of itemsToCreate) {
    createdItems.push(
      await prisma.groceryItem.create({ data: itemToCreate, include: groceryItemInclude })
    );
  }

  return createdItems;
};

const mergeKeyOf = (name: string, unit: string | null) =>
  `${name.trim().toLowerCase()}::${unit?.trim().toLowerCase() ?? ""}`;

/**
 * Copies a saved dish's ingredients onto a plan's grocery list, attached to the
 * planned meal they were added for.
 *
 * Ingredients the meal already carries under the same name and unit are left
 * alone, so pressing the button twice — or pressing it again after adding one
 * more ingredient to the dish — tops the list up instead of duplicating it.
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

  const existingItems = await prisma.groceryItem.findMany({
    where: {
      planDayId: { in: params.planDayIds },
      ...(typeof params.mealLink.dinnerDishId === "number"
        ? { dinnerDishId: params.mealLink.dinnerDishId }
        : {}),
      ...(typeof params.mealLink.breakfastDishId === "number"
        ? { breakfastDishId: params.mealLink.breakfastDishId }
        : {}),
      ...(typeof params.mealLink.lunchDishId === "number"
        ? { lunchDishId: params.mealLink.lunchDishId }
        : {})
    },
    select: { name: true, unit: true }
  });

  const existingKeys = new Set(
    existingItems.map((existingItem) => mergeKeyOf(existingItem.name, existingItem.unit))
  );
  const ingredientsToAdd = dish.ingredients.filter(
    (ingredient) => !existingKeys.has(mergeKeyOf(ingredient.name, ingredient.unit))
  );

  if (ingredientsToAdd.length === 0) {
    return { status: "added", createdItems: [], skippedCount: dish.ingredients.length };
  }

  const nextSortOrder = await getNextGrocerySortOrder(params.planDayIds);

  const createdItems = await createGroceryItemsForDish(
    ingredientsToAdd.map((ingredient, position) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      category: GroceryCategory.INGREDIENT,
      sortOrder: nextSortOrder + position,
      planDayId: params.planDayId,
      dinnerDishId: params.mealLink.dinnerDishId ?? null,
      breakfastDishId: params.mealLink.breakfastDishId ?? null,
      lunchDishId: params.mealLink.lunchDishId ?? null
    }))
  );

  return {
    status: "added",
    createdItems,
    skippedCount: dish.ingredients.length - createdItems.length
  };
};
