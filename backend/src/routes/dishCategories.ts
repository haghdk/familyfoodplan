import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const dishCategoriesRouter = Router();

// The guard is attached per route rather than with a path-less `router.use(...)`.
// Every router here is mounted at the application root, so a path-less guard
// runs on *every* request that reaches this router, including requests meant
// for routers registered after it.

const dishCategorySelect = {
  id: true,
  name: true,
  _count: {
    select: { dishes: true }
  }
} as const;

type DishCategoryRow = {
  id: number;
  name: string;
  _count: { dishes: number };
};

/** The shape every category endpoint answers with, counts flattened. */
const mapDishCategory = (dishCategory: DishCategoryRow) => ({
  id: dishCategory.id,
  name: dishCategory.name,
  dishCount: dishCategory._count.dishes
});

const parseDishCategoryId = (rawValue: string) => {
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) ? parsedValue : null;
};

const isUniqueNameConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

dishCategoriesRouter.get("/api/dish-categories", requireAuth, async (_request, response) => {
  const dishCategories = await prisma.dishCategory.findMany({
    orderBy: { name: "asc" },
    select: dishCategorySelect
  });

  response.status(200).json({ dishCategories: dishCategories.map(mapDishCategory) });
});

dishCategoriesRouter.post("/api/dish-categories", requireAuth, async (request, response) => {
  const { name } = request.body as { name?: unknown };
  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: "Category name is required." });
    return;
  }

  try {
    const dishCategory = await prisma.dishCategory.create({
      data: { name: normalizedName },
      select: dishCategorySelect
    });

    response.status(201).json({ dishCategory: mapDishCategory(dishCategory) });
  } catch (error: unknown) {
    if (isUniqueNameConflict(error)) {
      response.status(409).json({ message: "A category with that name already exists." });
      return;
    }

    throw error;
  }
});

dishCategoriesRouter.put(
  "/api/dish-categories/:categoryId",
  requireAuth,
  async (request, response) => {
    const categoryId = parseDishCategoryId(request.params.categoryId);

    if (categoryId === null) {
      response.status(400).json({ message: "Invalid category id." });
      return;
    }

    const { name } = request.body as { name?: unknown };
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      response.status(400).json({ message: "Category name is required." });
      return;
    }

    const existingCategory = await prisma.dishCategory.findUnique({
      where: { id: categoryId },
      select: { id: true }
    });

    if (!existingCategory) {
      response.status(404).json({ message: "Category not found." });
      return;
    }

    try {
      const dishCategory = await prisma.dishCategory.update({
        where: { id: categoryId },
        data: { name: normalizedName },
        select: dishCategorySelect
      });

      response.status(200).json({ dishCategory: mapDishCategory(dishCategory) });
    } catch (error: unknown) {
      if (isUniqueNameConflict(error)) {
        response.status(409).json({ message: "A category with that name already exists." });
        return;
      }

      throw error;
    }
  }
);

/**
 * Deleting a category is deleting a shelf, not what was on it: the dishes stay,
 * and fall back to being uncategorised. That is what the nullable `categoryId`
 * and its `ON DELETE SET NULL` are for — a mistyped category name should never
 * be a way to lose a recipe.
 */
dishCategoriesRouter.delete(
  "/api/dish-categories/:categoryId",
  requireAuth,
  async (request, response) => {
    const categoryId = parseDishCategoryId(request.params.categoryId);

    if (categoryId === null) {
      response.status(400).json({ message: "Invalid category id." });
      return;
    }

    const existingCategory = await prisma.dishCategory.findUnique({
      where: { id: categoryId },
      select: { id: true }
    });

    if (!existingCategory) {
      response.status(404).json({ message: "Category not found." });
      return;
    }

    await prisma.dishCategory.delete({ where: { id: categoryId } });

    response.status(204).send();
  }
);

export default dishCategoriesRouter;
