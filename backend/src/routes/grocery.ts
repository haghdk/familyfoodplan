import { GroceryCategory } from "../generated/prisma/enums";
import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { getMergedGroceryItemsByPlanDay } from "../services/grocery";
import { GroceryEventType, realtimeBus } from "../realtime/events";

const groceryRouter = Router();

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

const createShareToken = () => crypto.randomBytes(32).toString("hex");

const parseShareToken = (rawValue: string | undefined) => {
  if (!rawValue) {
    return null;
  }

  const decodedValue = decodeURIComponent(rawValue).trim();
  const tokenMatch = decodedValue.match(/[a-f0-9]{64}/i);

  return tokenMatch?.[0]?.toLowerCase() ?? null;
};

const resolvePlanDayId = async (planOrPlanDayId: number) => {
  const plan = await prisma.plan.findUnique({
    where: { id: planOrPlanDayId },
    select: { days: { select: { id: true }, orderBy: { date: "asc" }, take: 1 } }
  });

  if (plan?.days[0]) {
    return plan.days[0].id;
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planOrPlanDayId },
    select: { id: true }
  });

  if (planDay) {
    return planDay.id;
  }

  return null;
};

const getShareTokenByPlanId = async (planId: number) => {
  const shareToken = await prisma.groceryShareToken.findUnique({
    where: { planDayId: planId },
    select: { token: true }
  });

  return shareToken?.token ?? null;
};

const emitGroceryEvent = async (
  planId: number,
  eventType: GroceryEventType,
  payload: {
    item: {
      id: number;
      name: string;
      quantity: number;
      unit: string | null;
      category: GroceryCategory;
      isChecked: boolean;
      dinnerDish: { id: number; name: string } | null;
      lunchDish: { id: number; name: string } | null;
    } | null;
    deletedItemId: number | null;
  }
) => {
  const token = await getShareTokenByPlanId(planId);

  realtimeBus.emit({
    eventType,
    planId,
    token,
    item: payload.item
      ? {
          ...payload.item,
          category: payload.item.category
        }
      : null,
    deletedItemId: payload.deletedItemId
  });
};

groceryRouter.get("/api/plans/:planId/grocery-items", requireAdminAuth, async (request, response) => {
  const planOrPlanDayId = parsePlanId(request.params.planId);

  if (!planOrPlanDayId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const planDayId = await resolvePlanDayId(planOrPlanDayId);

  if (!planDayId) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planDayId },
    select: { id: true }
  });

  if (!planDay) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const planMeals = await prisma.planDay.findUnique({
    where: { id: planDayId },
    select: {
      id: true,
      date: true,
      dinnerDish: { select: { id: true, name: true } },
      lunchDishes: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } }
    }
  });

  const groceryItems = await prisma.groceryItem.findMany({
    where: { planDayId },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    },
    orderBy: [{ category: "asc" }, { name: "asc" }, { createdAt: "asc" }]
  });

  const mergedItems = await getMergedGroceryItemsByPlanDay(planDayId);

  response.status(200).json({ plan: planMeals, groceryItems, mergedItems });
});

groceryRouter.post("/api/plans/:id/share-link", requireAdminAuth, async (request, response) => {
  const planId = parsePlanId(request.params.id);

  if (!planId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const planDayId = await resolvePlanDayId(planId);

  if (!planDayId) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const existingShareToken = await prisma.groceryShareToken.findUnique({
    where: { planDayId },
    select: { token: true }
  });

  if (existingShareToken) {
    response.status(200).json({ token: existingShareToken.token, existed: true });
    return;
  }

  const groceryShareToken = await prisma.groceryShareToken.create({
    data: { planDayId, token: createShareToken() },
    select: { token: true }
  });

  response.status(200).json({ token: groceryShareToken.token, existed: false });
});

groceryRouter.post("/api/plans/:id/share-link/rotate", requireAdminAuth, async (request, response) => {
  const planId = parsePlanId(request.params.id);

  if (!planId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const planDayId = await resolvePlanDayId(planId);

  if (!planDayId) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const nextToken = createShareToken();

  const groceryShareToken = await prisma.groceryShareToken.upsert({
    where: { planDayId },
    update: { token: nextToken },
    create: { planDayId, token: nextToken },
    select: { token: true }
  });

  response.status(200).json({ token: groceryShareToken.token, rotated: true });
});

groceryRouter.post("/api/plans/:planId/grocery-items", requireAdminAuth, async (request, response) => {
  const planOrPlanDayId = parsePlanId(request.params.planId);

  if (!planOrPlanDayId) {
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

  const planDayId = await resolvePlanDayId(planOrPlanDayId);

  if (!planDayId) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planDayId },
    select: { id: true }
  });

  if (!planDay) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  if (typeof dinnerDishId === "number") {
    const dinnerDish = await prisma.dinnerDish.findFirst({
      where: { id: dinnerDishId, planDayId },
      select: { id: true }
    });

    if (!dinnerDish) {
      response.status(400).json({ message: "Dinner dish does not belong to this plan." });
      return;
    }
  }

  if (typeof lunchDishId === "number") {
    const lunchDish = await prisma.lunchDish.findFirst({
      where: { id: lunchDishId, planDayId },
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
      planDayId,
      dinnerDishId: typeof dinnerDishId === "number" ? dinnerDishId : null,
      lunchDishId: typeof lunchDishId === "number" ? lunchDishId : null
    },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  await emitGroceryEvent(planDayId, "grocery_item_created", {
    item: groceryItem,
    deletedItemId: null
  });

  response.status(201).json({ groceryItem });
});

groceryRouter.put("/api/plans/:planId/grocery-items/:itemId", requireAdminAuth, async (request, response) => {
  const planOrPlanDayId = parsePlanId(request.params.planId);
  const itemId = parsePlanId(request.params.itemId);

  if (!planOrPlanDayId || !itemId) {
    response.status(400).json({ message: "Invalid plan or item id." });
    return;
  }

  const planDayId = await resolvePlanDayId(planOrPlanDayId);

  if (!planDayId) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const existingItem = await prisma.groceryItem.findFirst({
    where: { id: itemId, planDayId },
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

  await emitGroceryEvent(planDayId, "grocery_item_updated", {
    item: groceryItem,
    deletedItemId: null
  });

  response.status(200).json({ groceryItem });
});

groceryRouter.delete(
  "/api/plans/:planId/grocery-items/:itemId",
  requireAdminAuth,
  async (request, response) => {
    const planOrPlanDayId = parsePlanId(request.params.planId);
    const itemId = parsePlanId(request.params.itemId);

    if (!planOrPlanDayId || !itemId) {
      response.status(400).json({ message: "Invalid plan or item id." });
      return;
    }

    const planDayId = await resolvePlanDayId(planOrPlanDayId);

    if (!planDayId) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    const existingItem = await prisma.groceryItem.findFirst({
      where: { id: itemId, planDayId },
      select: { id: true }
    });

    if (!existingItem) {
      response.status(404).json({ message: "Grocery item not found for this plan." });
      return;
    }

    await prisma.groceryItem.delete({ where: { id: itemId } });

    await emitGroceryEvent(planDayId, "grocery_item_deleted", {
      item: null,
      deletedItemId: itemId
    });

    response.status(204).send();
  }
);

groceryRouter.get("/api/grocery/shared/:token", async (request, response) => {
  const shareToken = parseShareToken(request.params.token);

  if (!shareToken) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const sharedPlan = await prisma.groceryShareToken.findUnique({
    where: { token: shareToken },
    include: {
      planDay: {
        select: {
          id: true,
          date: true,
          groceryItems: {
            include: {
              dinnerDish: { select: { id: true, name: true } },
              lunchDish: { select: { id: true, name: true } }
            },
            orderBy: [{ category: "asc" }, { name: "asc" }, { createdAt: "asc" }]
          }
        }
      }
    }
  });

  if (!sharedPlan) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const mergedItems = await getMergedGroceryItemsByPlanDay(sharedPlan.planDay.id);

  response.status(200).json({
    plan: {
      id: sharedPlan.planDay.id,
      date: sharedPlan.planDay.date
    },
    groceryItems: sharedPlan.planDay.groceryItems,
    mergedItems
  });
});

groceryRouter.patch("/api/grocery/shared/:token/items/:itemId", async (request, response) => {
  const shareToken = parseShareToken(request.params.token);
  const itemId = parsePlanId(request.params.itemId);

  if (!shareToken || !itemId) {
    response.status(400).json({ message: "Invalid share token or item id." });
    return;
  }

  const { isChecked } = request.body as { isChecked?: boolean };

  if (typeof isChecked !== "boolean") {
    response.status(400).json({ message: "isChecked must be a boolean." });
    return;
  }

  const sharedPlan = await prisma.groceryShareToken.findUnique({
    where: { token: shareToken },
    select: { planDayId: true }
  });

  if (!sharedPlan) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const existingItem = await prisma.groceryItem.findFirst({
    where: { id: itemId, planDayId: sharedPlan.planDayId },
    select: { id: true }
  });

  if (!existingItem) {
    response.status(404).json({ message: "Grocery item not found for this shared plan." });
    return;
  }

  const groceryItem = await prisma.groceryItem.update({
    where: { id: itemId },
    data: { isChecked },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  await emitGroceryEvent(sharedPlan.planDayId, "grocery_item_updated", {
    item: groceryItem,
    deletedItemId: null
  });

  response.status(200).json({ groceryItem });
});

export default groceryRouter;
