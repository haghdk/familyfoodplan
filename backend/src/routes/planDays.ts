import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { isSwappableMealType, swapPlanDayMeals } from "../services/mealSwaps";
import { parseIsoDayKey } from "../services/plans";

const planDaysRouter = Router();

planDaysRouter.use(requireAdminAuth);

// A meal can be picked from the saved dishes instead of being typed in, and the
// link is what later lets the plan copy the dish's ingredients onto the grocery
// list. Anything that is not a number means "typed in by hand", which clears an
// earlier link when a meal is renamed away from the dish it came from.
const resolveDishLink = async (
  rawDishId: unknown
): Promise<{ status: "unknown_dish" } | { status: "resolved"; dishId: number | null }> => {
  if (typeof rawDishId !== "number") {
    return { status: "resolved", dishId: null };
  }

  const dish = await prisma.dish.findUnique({
    where: { id: rawDishId },
    select: { id: true }
  });

  return dish ? { status: "resolved", dishId: dish.id } : { status: "unknown_dish" };
};

const findPlanDayForPlan = async (planId: number, dayDate: Date) =>
  prisma.planDay.findUnique({
    where: {
      planId_date: {
        planId,
        date: dayDate
      }
    },
    select: { id: true }
  });

planDaysRouter.post("/api/plans/:planId/meal-swaps", async (request, response) => {
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const { mealType, sourceDayKey, targetDayKey } = request.body as {
    mealType?: unknown;
    sourceDayKey?: unknown;
    targetDayKey?: unknown;
  };

  if (!isSwappableMealType(mealType)) {
    response
      .status(400)
      .json({ message: "mealType must be one of breakfast, lunch, or dinner." });
    return;
  }

  if (typeof sourceDayKey !== "string" || typeof targetDayKey !== "string") {
    response
      .status(400)
      .json({ message: "sourceDayKey and targetDayKey are required." });
    return;
  }

  const sourceDayDate = parseIsoDayKey(sourceDayKey);
  const targetDayDate = parseIsoDayKey(targetDayKey);

  if (!sourceDayDate || !targetDayDate) {
    response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
    return;
  }

  if (sourceDayDate.getTime() === targetDayDate.getTime()) {
    response.status(400).json({ message: "Pick two different days to swap." });
    return;
  }

  const swapResult = await swapPlanDayMeals({
    planId,
    mealType,
    sourceDayDate,
    targetDayDate,
    sourceDayKey,
    targetDayKey
  });

  if (swapResult.status === "plan_days_not_found") {
    response.status(404).json({
      message: "Plan day not found for this plan.",
      missingDayKeys: swapResult.missingDayKeys
    });
    return;
  }

  response.status(200).json({ planDays: swapResult.planDays });
});

planDaysRouter.put("/api/plans/:planId/days/:dayKey/dinner", async (request, response) => {
  const planId = Number(request.params.planId);
  const dayDate = parseIsoDayKey(request.params.dayKey);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  if (!dayDate) {
    response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
    return;
  }

  const { name, notes, dishId } = request.body as {
    name?: string;
    notes?: string;
    dishId?: number | null;
  };
  const normalizedName = name?.trim();

  if (!normalizedName) {
    response.status(400).json({ message: "Dinner name is required." });
    return;
  }

  const dishLink = await resolveDishLink(dishId);

  if (dishLink.status === "unknown_dish") {
    response.status(400).json({ message: "Selected dish does not exist." });
    return;
  }

  const planDay = await findPlanDayForPlan(planId, dayDate);

  if (!planDay) {
    response.status(404).json({ message: "Plan day not found for this plan." });
    return;
  }

  const dinnerDish = await prisma.dinnerDish.upsert({
    where: { planDayId: planDay.id },
    update: {
      name: normalizedName,
      notes: notes?.trim() || null,
      dishId: dishLink.dishId
    },
    create: {
      name: normalizedName,
      notes: notes?.trim() || null,
      dishId: dishLink.dishId,
      planDayId: planDay.id
    }
  });

  response.status(200).json({ dinnerDish });
});


planDaysRouter.post("/api/plans/:planId/days/:dayKey/breakfasts", async (request, response) => {
  const planId = Number(request.params.planId);
  const dayDate = parseIsoDayKey(request.params.dayKey);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  if (!dayDate) {
    response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
    return;
  }

  const { name, notes, familyMemberId, dishId } = request.body as {
    name?: string;
    notes?: string;
    familyMemberId?: number | null;
    dishId?: number | null;
  };
  const normalizedName = name?.trim();

  if (!normalizedName) {
    response.status(400).json({ message: "Breakfast name is required." });
    return;
  }

  if (typeof familyMemberId === "number") {
    const familyMember = await prisma.familyMember.findUnique({
      where: { id: familyMemberId },
      select: { id: true }
    });

    if (!familyMember) {
      response.status(400).json({ message: "Selected member does not exist." });
      return;
    }
  }

  const dishLink = await resolveDishLink(dishId);

  if (dishLink.status === "unknown_dish") {
    response.status(400).json({ message: "Selected dish does not exist." });
    return;
  }

  const planDay = await findPlanDayForPlan(planId, dayDate);

  if (!planDay) {
    response.status(404).json({ message: "Plan day not found for this plan." });
    return;
  }

  const breakfastDish = await prisma.breakfastDish.create({
    data: {
      name: normalizedName,
      notes: notes?.trim() || null,
      familyMemberId: typeof familyMemberId === "number" ? familyMemberId : null,
      dishId: dishLink.dishId,
      planDayId: planDay.id
    }
  });

  response.status(201).json({ breakfastDish });
});

planDaysRouter.put(
  "/api/plans/:planId/days/:dayKey/breakfasts/:breakfastId",
  async (request, response) => {
    const planId = Number(request.params.planId);
    const dayDate = parseIsoDayKey(request.params.dayKey);
    const breakfastId = Number(request.params.breakfastId);

    if (Number.isNaN(planId)) {
      response.status(400).json({ message: "Invalid plan id." });
      return;
    }

    if (!dayDate) {
      response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
      return;
    }

    if (Number.isNaN(breakfastId)) {
      response.status(400).json({ message: "Invalid breakfast id." });
      return;
    }

    const { name, notes, familyMemberId, dishId } = request.body as {
      name?: string;
      notes?: string;
      familyMemberId?: number | null;
      dishId?: number | null;
    };
    const normalizedName = name?.trim();

    if (!normalizedName) {
      response.status(400).json({ message: "Breakfast name is required." });
      return;
    }

    if (typeof familyMemberId === "number") {
      const familyMember = await prisma.familyMember.findUnique({
        where: { id: familyMemberId },
        select: { id: true }
      });

      if (!familyMember) {
        response.status(400).json({ message: "Selected member does not exist." });
        return;
      }
    }

    const dishLink = await resolveDishLink(dishId);

    if (dishLink.status === "unknown_dish") {
      response.status(400).json({ message: "Selected dish does not exist." });
      return;
    }

    const existingBreakfast = await prisma.breakfastDish.findFirst({
      where: {
        id: breakfastId,
        planDay: {
          planId,
          date: dayDate
        }
      },
      include: {
        planDay: {
          select: { date: true }
        }
      }
    });

    if (!existingBreakfast || existingBreakfast.planDay.date.getTime() !== dayDate.getTime()) {
      response.status(404).json({ message: "Breakfast dish not found for this day." });
      return;
    }

    const breakfastDish = await prisma.breakfastDish.update({
      where: { id: breakfastId },
      data: {
        name: normalizedName,
        notes: notes?.trim() || null,
        familyMemberId: typeof familyMemberId === "number" ? familyMemberId : null,
        dishId: dishLink.dishId
      }
    });

    response.status(200).json({ breakfastDish });
  }
);

planDaysRouter.delete(
  "/api/plans/:planId/days/:dayKey/breakfasts/:breakfastId",
  async (request, response) => {
    const planId = Number(request.params.planId);
    const dayDate = parseIsoDayKey(request.params.dayKey);
    const breakfastId = Number(request.params.breakfastId);

    if (Number.isNaN(planId)) {
      response.status(400).json({ message: "Invalid plan id." });
      return;
    }

    if (!dayDate) {
      response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
      return;
    }

    if (Number.isNaN(breakfastId)) {
      response.status(400).json({ message: "Invalid breakfast id." });
      return;
    }

    const existingBreakfast = await prisma.breakfastDish.findFirst({
      where: {
        id: breakfastId,
        planDay: {
          planId,
          date: dayDate
        }
      },
      include: {
        planDay: {
          select: { date: true }
        }
      }
    });

    if (!existingBreakfast || existingBreakfast.planDay.date.getTime() !== dayDate.getTime()) {
      response.status(404).json({ message: "Breakfast dish not found for this day." });
      return;
    }

    await prisma.breakfastDish.delete({ where: { id: breakfastId } });

    response.status(204).send();
  }
);

planDaysRouter.post("/api/plans/:planId/days/:dayKey/lunches", async (request, response) => {
  const planId = Number(request.params.planId);
  const dayDate = parseIsoDayKey(request.params.dayKey);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  if (!dayDate) {
    response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
    return;
  }

  const { name, notes, familyMemberId, dishId } = request.body as {
    name?: string;
    notes?: string;
    familyMemberId?: number | null;
    dishId?: number | null;
  };
  const normalizedName = name?.trim();

  if (!normalizedName) {
    response.status(400).json({ message: "Lunch name is required." });
    return;
  }

  if (typeof familyMemberId === "number") {
    const familyMember = await prisma.familyMember.findUnique({
      where: { id: familyMemberId },
      select: { id: true }
    });

    if (!familyMember) {
      response.status(400).json({ message: "Selected member does not exist." });
      return;
    }
  }

  const dishLink = await resolveDishLink(dishId);

  if (dishLink.status === "unknown_dish") {
    response.status(400).json({ message: "Selected dish does not exist." });
    return;
  }

  const planDay = await findPlanDayForPlan(planId, dayDate);

  if (!planDay) {
    response.status(404).json({ message: "Plan day not found for this plan." });
    return;
  }

  const lunchDish = await prisma.lunchDish.create({
    data: {
      name: normalizedName,
      notes: notes?.trim() || null,
      familyMemberId: typeof familyMemberId === "number" ? familyMemberId : null,
      dishId: dishLink.dishId,
      planDayId: planDay.id
    }
  });

  response.status(201).json({ lunchDish });
});

planDaysRouter.put(
  "/api/plans/:planId/days/:dayKey/lunches/:lunchId",
  async (request, response) => {
    const planId = Number(request.params.planId);
    const dayDate = parseIsoDayKey(request.params.dayKey);
    const lunchId = Number(request.params.lunchId);

    if (Number.isNaN(planId)) {
      response.status(400).json({ message: "Invalid plan id." });
      return;
    }

    if (!dayDate) {
      response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
      return;
    }

    if (Number.isNaN(lunchId)) {
      response.status(400).json({ message: "Invalid lunch id." });
      return;
    }

    const { name, notes, familyMemberId, dishId } = request.body as {
      name?: string;
      notes?: string;
      familyMemberId?: number | null;
      dishId?: number | null;
    };
    const normalizedName = name?.trim();

    if (!normalizedName) {
      response.status(400).json({ message: "Lunch name is required." });
      return;
    }

    if (typeof familyMemberId === "number") {
      const familyMember = await prisma.familyMember.findUnique({
        where: { id: familyMemberId },
        select: { id: true }
      });

      if (!familyMember) {
        response.status(400).json({ message: "Selected member does not exist." });
        return;
      }
    }

    const dishLink = await resolveDishLink(dishId);

    if (dishLink.status === "unknown_dish") {
      response.status(400).json({ message: "Selected dish does not exist." });
      return;
    }

    const existingLunch = await prisma.lunchDish.findFirst({
      where: {
        id: lunchId,
        planDay: {
          planId,
          date: dayDate
        }
      },
      include: {
        planDay: {
          select: { date: true }
        }
      }
    });

    if (!existingLunch || existingLunch.planDay.date.getTime() !== dayDate.getTime()) {
      response.status(404).json({ message: "Lunch dish not found for this day." });
      return;
    }

    const lunchDish = await prisma.lunchDish.update({
      where: { id: lunchId },
      data: {
        name: normalizedName,
        notes: notes?.trim() || null,
        familyMemberId: typeof familyMemberId === "number" ? familyMemberId : null,
        dishId: dishLink.dishId
      }
    });

    response.status(200).json({ lunchDish });
  }
);

planDaysRouter.delete(
  "/api/plans/:planId/days/:dayKey/lunches/:lunchId",
  async (request, response) => {
    const planId = Number(request.params.planId);
    const dayDate = parseIsoDayKey(request.params.dayKey);
    const lunchId = Number(request.params.lunchId);

    if (Number.isNaN(planId)) {
      response.status(400).json({ message: "Invalid plan id." });
      return;
    }

    if (!dayDate) {
      response.status(400).json({ message: "Invalid day key. Expected YYYY-MM-DD." });
      return;
    }

    if (Number.isNaN(lunchId)) {
      response.status(400).json({ message: "Invalid lunch id." });
      return;
    }

    const existingLunch = await prisma.lunchDish.findFirst({
      where: {
        id: lunchId,
        planDay: {
          planId,
          date: dayDate
        }
      },
      include: {
        planDay: {
          select: { date: true }
        }
      }
    });

    if (!existingLunch || existingLunch.planDay.date.getTime() !== dayDate.getTime()) {
      response.status(404).json({ message: "Lunch dish not found for this day." });
      return;
    }

    await prisma.lunchDish.delete({ where: { id: lunchId } });

    response.status(204).send();
  }
);

export default planDaysRouter;
