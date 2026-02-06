import { GroceryCategory } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { getMergedGroceryItemsByPlanDay } from "../services/grocery";

const groceryRouter = Router();

groceryRouter.use(requireAdminAuth);

const parsePlanId = (rawValue: string) => {
  const parsedValue = Number(rawValue);
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

const parseCategory = (category: unknown): GroceryCategory =>
  category === GroceryCategory.INGREDIENT
    ? GroceryCategory.INGREDIENT
    : GroceryCategory.GENERAL;

const normalizeName = (name: unknown) =>
  typeof name === "string" ? name.trim() : "";

const normalizeQuantity = (quantity: unknown) => {
  if (typeof quantity === "number" && quantity > 0) {
    return quantity;
  }

  return 1;
};

groceryRouter.get("/api/plans/:planId/grocery-items", async (request, response) => {
  const planId = parsePlanId(request.params.planId);

  if (!planId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planId },
    select: { id: true }
  });

  if (!planDay) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const planMeals = await prisma.planDay.findUnique({
    where: { id: planId },
    select: {
      id: true,
      date: true,
      dinnerDish: { select: { id: true, name: true } },
      lunchDishes: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } }
    }
  });

  const groceryItems = await prisma.groceryItem.findMany({
    where: { planDayId: planId },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    },
    orderBy: [{ category: "asc" }, { name: "asc" }, { createdAt: "asc" }]
  });

  const mergedItems = await getMergedGroceryItemsByPlanDay(planId);

  response.status(200).json({ plan: planMeals, groceryItems, mergedItems });
});

groceryRouter.post("/api/plans/:planId/grocery-items", async (request, response) => {
  const planId = parsePlanId(request.params.planId);

  if (!planId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const { name, quantity, unit, category, dinnerDishId, lunchDishId } = request.body as {
    name?: string;
    quantity?: number;
    unit?: string | null;
    category?: GroceryCategory;
    dinnerDishId?: number | null;
    lunchDishId?: number | null;
  };

  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    response.status(400).json({ message: "Grocery item name is required." });
    return;
  }

  if (typeof dinnerDishId === "number" && typeof lunchDishId === "number") {
    response.status(400).json({ message: "Attach an item to either dinner or lunch, not both." });
    return;
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planId },
    select: { id: true }
  });

  if (!planDay) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  if (typeof dinnerDishId === "number") {
    const dinnerDish = await prisma.dinnerDish.findFirst({
      where: { id: dinnerDishId, planDayId: planId },
      select: { id: true }
    });

    if (!dinnerDish) {
      response.status(400).json({ message: "Dinner dish does not belong to this plan." });
      return;
    }
  }

  if (typeof lunchDishId === "number") {
    const lunchDish = await prisma.lunchDish.findFirst({
      where: { id: lunchDishId, planDayId: planId },
      select: { id: true }
    });

    if (!lunchDish) {
      response.status(400).json({ message: "Lunch dish does not belong to this plan." });
      return;
    }
  }

  const groceryItem = await prisma.groceryItem.create({
    data: {
      name: normalizedName,
      quantity: normalizeQuantity(quantity),
      unit: typeof unit === "string" ? unit.trim() || null : null,
      category: parseCategory(category),
      planDayId: planId,
      dinnerDishId: typeof dinnerDishId === "number" ? dinnerDishId : null,
      lunchDishId: typeof lunchDishId === "number" ? lunchDishId : null
    },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  response.status(201).json({ groceryItem });
});

groceryRouter.put("/api/plans/:planId/grocery-items/:itemId", async (request, response) => {
  const planId = parsePlanId(request.params.planId);
  const itemId = parsePlanId(request.params.itemId);

  if (!planId || !itemId) {
    response.status(400).json({ message: "Invalid plan or item id." });
    return;
  }

  const existingItem = await prisma.groceryItem.findFirst({
    where: { id: itemId, planDayId: planId },
    select: { id: true }
  });

  if (!existingItem) {
    response.status(404).json({ message: "Grocery item not found for this plan." });
    return;
  }

  const { name, quantity, unit } = request.body as {
    name?: string;
    quantity?: number;
    unit?: string | null;
  };

  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    response.status(400).json({ message: "Grocery item name is required." });
    return;
  }

  const groceryItem = await prisma.groceryItem.update({
    where: { id: itemId },
    data: {
      name: normalizedName,
      quantity: normalizeQuantity(quantity),
      unit: typeof unit === "string" ? unit.trim() || null : null
    },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  response.status(200).json({ groceryItem });
});

groceryRouter.delete(
  "/api/plans/:planId/grocery-items/:itemId",
  async (request, response) => {
    const planId = parsePlanId(request.params.planId);
    const itemId = parsePlanId(request.params.itemId);

    if (!planId || !itemId) {
      response.status(400).json({ message: "Invalid plan or item id." });
      return;
    }

    const existingItem = await prisma.groceryItem.findFirst({
      where: { id: itemId, planDayId: planId },
      select: { id: true }
    });

    if (!existingItem) {
      response.status(404).json({ message: "Grocery item not found for this plan." });
      return;
    }

    await prisma.groceryItem.delete({ where: { id: itemId } });

    response.status(204).send();
  }
);

export default groceryRouter;
