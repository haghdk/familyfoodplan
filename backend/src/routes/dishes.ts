import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth, requireAuth } from "../middleware/auth";
import {
  dishSelect,
  parseDishIngredients,
  toIngredientCreateData
} from "../services/dishes";

const dishesRouter = Router();

const parseDishId = (rawValue: string) => {
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) ? parsedValue : null;
};

const isUniqueNameConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

dishesRouter.get("/api/dishes", requireAuth, async (_request, response) => {
  const dishes = await prisma.dish.findMany({
    orderBy: { name: "asc" },
    select: dishSelect
  });

  response.status(200).json({ dishes });
});

dishesRouter.post("/api/dishes", requireAdminAuth, async (request, response) => {
  const { name, notes, ingredients } = request.body as {
    name?: unknown;
    notes?: unknown;
    ingredients?: unknown;
  };

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: "Dish name is required." });
    return;
  }

  const parsedIngredients = parseDishIngredients(ingredients);

  if (parsedIngredients.status === "invalid") {
    response.status(400).json({ message: parsedIngredients.message });
    return;
  }

  try {
    const dish = await prisma.dish.create({
      data: {
        name: normalizedName,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        ingredients: {
          create: toIngredientCreateData(parsedIngredients.ingredients)
        }
      },
      select: dishSelect
    });

    response.status(201).json({ dish });
  } catch (error: unknown) {
    if (isUniqueNameConflict(error)) {
      response.status(409).json({ message: "A dish with that name already exists." });
      return;
    }

    throw error;
  }
});

dishesRouter.put("/api/dishes/:dishId", requireAdminAuth, async (request, response) => {
  const dishId = parseDishId(request.params.dishId);

  if (dishId === null) {
    response.status(400).json({ message: "Invalid dish id." });
    return;
  }

  const { name, notes, ingredients } = request.body as {
    name?: unknown;
    notes?: unknown;
    ingredients?: unknown;
  };

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: "Dish name is required." });
    return;
  }

  const parsedIngredients = parseDishIngredients(ingredients);

  if (parsedIngredients.status === "invalid") {
    response.status(400).json({ message: parsedIngredients.message });
    return;
  }

  const existingDish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { id: true }
  });

  if (!existingDish) {
    response.status(404).json({ message: "Dish not found." });
    return;
  }

  try {
    // The ingredient list is sent whole, so the stored lines are replaced rather
    // than diffed. Grocery items already copied onto a plan are untouched by
    // this: they are their own rows once added, so editing a recipe never
    // rewrites a shopping list somebody is mid-way through.
    const dish = await prisma.$transaction(async (tx) => {
      await tx.dishIngredient.deleteMany({ where: { dishId } });

      return tx.dish.update({
        where: { id: dishId },
        data: {
          name: normalizedName,
          notes: typeof notes === "string" ? notes.trim() || null : null,
          ingredients: {
            create: toIngredientCreateData(parsedIngredients.ingredients)
          }
        },
        select: dishSelect
      });
    });

    response.status(200).json({ dish });
  } catch (error: unknown) {
    if (isUniqueNameConflict(error)) {
      response.status(409).json({ message: "A dish with that name already exists." });
      return;
    }

    throw error;
  }
});

dishesRouter.delete("/api/dishes/:dishId", requireAdminAuth, async (request, response) => {
  const dishId = parseDishId(request.params.dishId);

  if (dishId === null) {
    response.status(400).json({ message: "Invalid dish id." });
    return;
  }

  const existingDish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { id: true }
  });

  if (!existingDish) {
    response.status(404).json({ message: "Dish not found." });
    return;
  }

  await prisma.dish.delete({ where: { id: dishId } });

  response.status(204).send();
});

export default dishesRouter;
