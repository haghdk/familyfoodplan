import { GroceryCategory } from "../generated/prisma/enums";
import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { addDishIngredientsToGroceryList } from "../services/dishes";
import {
  getMergedGroceryItemsByPlanDays,
  getNextGrocerySortOrder,
  groceryItemOrderBy,
  reorderGroceryItems
} from "../services/grocery";
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

const resolvePlanScope = async (planOrPlanDayId: number) => {
  const plan = await prisma.plan.findUnique({
    where: { id: planOrPlanDayId },
    select: { id: true, days: { select: { id: true, date: true }, orderBy: { date: "asc" } } }
  });

  if (plan?.days.length) {
    return {
      planDayIds: plan.days.map((day) => day.id),
      defaultPlanDayId: plan.days[0].id
    };
  }

  const planDay = await prisma.planDay.findUnique({
    where: { id: planOrPlanDayId },
    select: { id: true }
  });

  if (planDay) {
    return {
      planDayIds: [planDay.id],
      defaultPlanDayId: planDay.id
    };
  }

  return null;
};

// A plan has a single share token, stored on its first day, while grocery items
// live on the day of the meal they belong to. Resolving the token through the
// plan means an item added on any day still reaches the shared list viewers.
const getShareTokenByPlanDayId = async (planDayId: number) => {
  const planDay = await prisma.planDay.findUnique({
    where: { id: planDayId },
    select: { planId: true }
  });

  if (!planDay) {
    return null;
  }

  const shareToken = await prisma.groceryShareToken.findFirst({
    where: { planDay: { planId: planDay.planId } },
    // The share link endpoints always hand out the token on the plan's first
    // day, so pick the same one when broadcasting.
    orderBy: { planDay: { date: "asc" } },
    select: { token: true }
  });

  return shareToken?.token ?? null;
};

// Every grocery item that belongs to the same plan as this share token, no
// matter which day of the plan its meal sits on.
const resolveSharedPlanScope = async (token: string) => {
  const shareToken = await prisma.groceryShareToken.findUnique({
    where: { token },
    select: {
      planDay: {
        select: {
          id: true,
          date: true,
          plan: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              days: { select: { id: true, date: true }, orderBy: { date: "asc" } }
            }
          }
        }
      }
    }
  });

  if (!shareToken) {
    return null;
  }

  const { plan } = shareToken.planDay;
  const planDays = plan.days;

  return {
    plan,
    planDayIds: planDays.map((planDay) => planDay.id),
    startDate: plan.startDate ?? planDays[0]?.date ?? shareToken.planDay.date,
    endDate: plan.endDate ?? planDays[planDays.length - 1]?.date ?? shareToken.planDay.date,
    tokenPlanDay: { id: shareToken.planDay.id, date: shareToken.planDay.date }
  };
};

const emitGroceryEvent = async (
  planDayId: number,
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
      breakfastDish: { id: number; name: string } | null;
      lunchDish: { id: number; name: string } | null;
    } | null;
    deletedItemId: number | null;
    orderedItemIds?: number[] | null;
  }
) => {
  const token = await getShareTokenByPlanDayId(planDayId);

  realtimeBus.emit({
    eventType,
    planId: planDayId,
    token,
    item: payload.item
      ? {
          ...payload.item,
          category: payload.item.category
        }
      : null,
    deletedItemId: payload.deletedItemId,
    orderedItemIds: payload.orderedItemIds ?? null
  });
};

groceryRouter.get("/api/plans/:planId/grocery-items", requireAdminAuth, async (request, response) => {
  const planOrPlanDayId = parsePlanId(request.params.planId);

  if (!planOrPlanDayId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const planScope = await resolvePlanScope(planOrPlanDayId);

  if (!planScope) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const planMeals = await prisma.planDay.findMany({
    where: { id: { in: planScope.planDayIds } },
    select: {
      id: true,
      date: true,
      dinnerDish: { select: { id: true, name: true } },
      breakfastDishes: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      lunchDishes: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } }
    },
    orderBy: { date: "asc" }
  });

  const groceryItems = await prisma.groceryItem.findMany({
    where: { planDayId: { in: planScope.planDayIds } },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      breakfastDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    },
    orderBy: groceryItemOrderBy
  });

  const mergedItems = await getMergedGroceryItemsByPlanDays(planScope.planDayIds);

  response.status(200).json({ planDays: planMeals, groceryItems, mergedItems });
});

groceryRouter.post("/api/plans/:id/share-link", requireAdminAuth, async (request, response) => {
  const planId = parsePlanId(request.params.id);

  if (!planId) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const planScope = await resolvePlanScope(planId);

  if (!planScope) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const existingShareToken = await prisma.groceryShareToken.findUnique({
    where: { planDayId: planScope.defaultPlanDayId },
    select: { token: true }
  });

  if (existingShareToken) {
    response.status(200).json({ token: existingShareToken.token, existed: true });
    return;
  }

  const groceryShareToken = await prisma.groceryShareToken.create({
    data: { planDayId: planScope.defaultPlanDayId, token: createShareToken() },
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

  const planScope = await resolvePlanScope(planId);

  if (!planScope) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const nextToken = createShareToken();

  const groceryShareToken = await prisma.groceryShareToken.upsert({
    where: { planDayId: planScope.defaultPlanDayId },
    update: { token: nextToken },
    create: { planDayId: planScope.defaultPlanDayId, token: nextToken },
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

  const { name, quantity, unit, category, dinnerDishId, breakfastDishId, lunchDishId } = request.body as {
    name?: string;
    quantity?: number;
    unit?: string | null;
    category?: GroceryCategory;
    dinnerDishId?: number | null;
    breakfastDishId?: number | null;
    lunchDishId?: number | null;
  };

  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    response.status(400).json({ message: "Grocery item name is required." });
    return;
  }

  const selectedMealIds = [dinnerDishId, breakfastDishId, lunchDishId].filter(
    (value): value is number => typeof value === "number"
  );

  if (selectedMealIds.length > 1) {
    response
      .status(400)
      .json({ message: "Attach an item to either dinner, breakfast, or lunch, not multiple meals." });
    return;
  }

  const planScope = await resolvePlanScope(planOrPlanDayId);

  if (!planScope) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  let itemPlanDayId = planScope.defaultPlanDayId;

  if (typeof dinnerDishId === "number") {
    const dinnerDish = await prisma.dinnerDish.findFirst({
      where: { id: dinnerDishId, planDayId: { in: planScope.planDayIds } },
      select: { id: true, planDayId: true }
    });

    if (!dinnerDish) {
      response.status(400).json({ message: "Dinner dish does not belong to this plan." });
      return;
    }

    itemPlanDayId = dinnerDish.planDayId;
  }

  if (typeof breakfastDishId === "number") {
    const breakfastDish = await prisma.breakfastDish.findFirst({
      where: { id: breakfastDishId, planDayId: { in: planScope.planDayIds } },
      select: { id: true, planDayId: true }
    });

    if (!breakfastDish) {
      response.status(400).json({ message: "Breakfast dish does not belong to this plan." });
      return;
    }

    itemPlanDayId = breakfastDish.planDayId;
  }

  if (typeof lunchDishId === "number") {
    const lunchDish = await prisma.lunchDish.findFirst({
      where: { id: lunchDishId, planDayId: { in: planScope.planDayIds } },
      select: { id: true, planDayId: true }
    });

    if (!lunchDish) {
      response.status(400).json({ message: "Lunch dish does not belong to this plan." });
      return;
    }

    itemPlanDayId = lunchDish.planDayId;
  }

  const nextSortOrder = await getNextGrocerySortOrder(planScope.planDayIds);

  const groceryItem = await prisma.groceryItem.create({
    data: {
      name: normalizedName,
      quantity: normalizeQuantity(quantity),
      unit: typeof unit === "string" ? unit.trim() || null : null,
      category: parseCategory(category),
      sortOrder: nextSortOrder,
      planDayId: itemPlanDayId,
      dinnerDishId: typeof dinnerDishId === "number" ? dinnerDishId : null,
      breakfastDishId: typeof breakfastDishId === "number" ? breakfastDishId : null,
      lunchDishId: typeof lunchDishId === "number" ? lunchDishId : null
    },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      breakfastDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  await emitGroceryEvent(itemPlanDayId, "grocery_item_created", {
    item: groceryItem,
    deletedItemId: null
  });

  response.status(201).json({ groceryItem });
});

// Locates the planned meal a grocery item is being attached to and reports the
// day it sits on, together with the saved dish it was picked from (when any).
const resolveMealForPlan = async (
  planDayIds: number[],
  mealLink: { dinnerDishId?: number | null; breakfastDishId?: number | null; lunchDishId?: number | null }
) => {
  if (typeof mealLink.dinnerDishId === "number") {
    return prisma.dinnerDish.findFirst({
      where: { id: mealLink.dinnerDishId, planDayId: { in: planDayIds } },
      select: { id: true, planDayId: true, dishId: true }
    });
  }

  if (typeof mealLink.breakfastDishId === "number") {
    return prisma.breakfastDish.findFirst({
      where: { id: mealLink.breakfastDishId, planDayId: { in: planDayIds } },
      select: { id: true, planDayId: true, dishId: true }
    });
  }

  if (typeof mealLink.lunchDishId === "number") {
    return prisma.lunchDish.findFirst({
      where: { id: mealLink.lunchDishId, planDayId: { in: planDayIds } },
      select: { id: true, planDayId: true, dishId: true }
    });
  }

  return null;
};

// Copies a saved dish's ingredients onto the plan's grocery list in one go,
// which is the whole point of writing a dish down once: the meal is picked on
// the plan, and its shopping follows with a single press.
groceryRouter.post(
  "/api/plans/:planId/grocery-items/from-dish",
  requireAdminAuth,
  async (request, response) => {
    const planOrPlanDayId = parsePlanId(request.params.planId);

    if (!planOrPlanDayId) {
      response.status(400).json({ message: "Invalid plan id." });
      return;
    }

    const { dishId, dinnerDishId, breakfastDishId, lunchDishId } = request.body as {
      dishId?: number | null;
      dinnerDishId?: number | null;
      breakfastDishId?: number | null;
      lunchDishId?: number | null;
    };

    const selectedMealIds = [dinnerDishId, breakfastDishId, lunchDishId].filter(
      (value): value is number => typeof value === "number"
    );

    if (selectedMealIds.length !== 1) {
      response
        .status(400)
        .json({ message: "Name exactly one of dinnerDishId, breakfastDishId, or lunchDishId." });
      return;
    }

    const planScope = await resolvePlanScope(planOrPlanDayId);

    if (!planScope) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    const mealLink = { dinnerDishId, breakfastDishId, lunchDishId };
    const meal = await resolveMealForPlan(planScope.planDayIds, mealLink);

    if (!meal) {
      response.status(400).json({ message: "That meal does not belong to this plan." });
      return;
    }

    // The meal remembers the dish it was picked from, so the caller normally
    // does not have to say which dish to copy.
    const resolvedDishId = typeof dishId === "number" ? dishId : meal.dishId;

    if (typeof resolvedDishId !== "number") {
      response
        .status(400)
        .json({ message: "This meal was not picked from a saved dish, so it has no ingredients." });
      return;
    }

    const addResult = await addDishIngredientsToGroceryList({
      dishId: resolvedDishId,
      planDayId: meal.planDayId,
      planDayIds: planScope.planDayIds,
      mealLink
    });

    if (addResult.status === "dish_not_found") {
      response.status(404).json({ message: "Dish not found." });
      return;
    }

    if (addResult.status === "no_ingredients") {
      response.status(400).json({ message: "That dish has no ingredients yet." });
      return;
    }

    for (const createdItem of addResult.createdItems) {
      await emitGroceryEvent(meal.planDayId, "grocery_item_created", {
        item: createdItem,
        deletedItemId: null
      });
    }

    response.status(201).json({
      groceryItems: addResult.createdItems,
      addedCount: addResult.createdItems.length,
      skippedCount: addResult.skippedCount,
      pantryPickups: addResult.pantryPickups
    });
  }
);

// Registered before the ":itemId" route so "order" is not parsed as an item id.
groceryRouter.put(
  "/api/plans/:planId/grocery-items/order",
  requireAdminAuth,
  async (request, response) => {
    const planOrPlanDayId = parsePlanId(request.params.planId);

    if (!planOrPlanDayId) {
      response.status(400).json({ message: "Invalid plan id." });
      return;
    }

    const { itemIds } = request.body as { itemIds?: unknown };

    if (
      !Array.isArray(itemIds) ||
      itemIds.some((itemId) => typeof itemId !== "number" || !Number.isInteger(itemId))
    ) {
      response.status(400).json({ message: "itemIds must be an array of grocery item ids." });
      return;
    }

    const planScope = await resolvePlanScope(planOrPlanDayId);

    if (!planScope) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    const reorderResult = await reorderGroceryItems(planScope.planDayIds, itemIds as number[]);

    if (reorderResult.status === "unknown_items") {
      response
        .status(400)
        .json({ message: "Some grocery items do not belong to this plan.", ...reorderResult });
      return;
    }

    await emitGroceryEvent(planScope.defaultPlanDayId, "grocery_items_reordered", {
      item: null,
      deletedItemId: null,
      orderedItemIds: reorderResult.orderedItemIds
    });

    response.status(200).json({ orderedItemIds: reorderResult.orderedItemIds });
  }
);

groceryRouter.put("/api/plans/:planId/grocery-items/:itemId", requireAdminAuth, async (request, response) => {
  const planOrPlanDayId = parsePlanId(request.params.planId);
  const itemId = parsePlanId(request.params.itemId);

  if (!planOrPlanDayId || !itemId) {
    response.status(400).json({ message: "Invalid plan or item id." });
    return;
  }

  const planScope = await resolvePlanScope(planOrPlanDayId);

  if (!planScope) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const existingItem = await prisma.groceryItem.findFirst({
    where: { id: itemId, planDayId: { in: planScope.planDayIds } },
    select: { id: true, planDayId: true }
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
      breakfastDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  await emitGroceryEvent(existingItem.planDayId, "grocery_item_updated", {
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

    const planScope = await resolvePlanScope(planOrPlanDayId);

    if (!planScope) {
      response.status(404).json({ message: "Plan not found." });
      return;
    }

    const existingItem = await prisma.groceryItem.findFirst({
      where: { id: itemId, planDayId: { in: planScope.planDayIds } },
      select: { id: true, planDayId: true }
    });

    if (!existingItem) {
      response.status(404).json({ message: "Grocery item not found for this plan." });
      return;
    }

    await prisma.groceryItem.delete({ where: { id: itemId } });

    await emitGroceryEvent(existingItem.planDayId, "grocery_item_deleted", {
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

  const sharedScope = await resolveSharedPlanScope(shareToken);

  if (!sharedScope) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const groceryItems = await prisma.groceryItem.findMany({
    where: { planDayId: { in: sharedScope.planDayIds } },
    include: {
      dinnerDish: { select: { id: true, name: true } },
      breakfastDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    },
    orderBy: groceryItemOrderBy
  });

  const mergedItems = await getMergedGroceryItemsByPlanDays(sharedScope.planDayIds);

  response.status(200).json({
    plan: {
      id: sharedScope.tokenPlanDay.id,
      date: sharedScope.tokenPlanDay.date,
      name: sharedScope.plan.name,
      startDate: sharedScope.startDate,
      endDate: sharedScope.endDate
    },
    groceryItems,
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

  const sharedScope = await resolveSharedPlanScope(shareToken);

  if (!sharedScope) {
    response.status(404).json({ message: "Shared grocery list not found." });
    return;
  }

  const existingItem = await prisma.groceryItem.findFirst({
    where: { id: itemId, planDayId: { in: sharedScope.planDayIds } },
    select: { id: true, planDayId: true }
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
      breakfastDish: { select: { id: true, name: true } },
      lunchDish: { select: { id: true, name: true } }
    }
  });

  await emitGroceryEvent(existingItem.planDayId, "grocery_item_updated", {
    item: groceryItem,
    deletedItemId: null
  });

  response.status(200).json({ groceryItem });
});

export default groceryRouter;
