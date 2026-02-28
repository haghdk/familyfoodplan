import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import {
  PlanConflictError,
  PlanValidationError,
  buildDateRange,
  createPlanWithDays,
  parseIsoDayKey
} from "../services/plans";

const plansRouter = Router();

plansRouter.use(requireAdminAuth);

const MAX_PLAN_SPAN_DAYS = 14;
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const parseDateKey = (rawValue: unknown): Date | null => {
  if (typeof rawValue !== "string") {
    return null;
  }

  return parseIsoDayKey(rawValue);
};

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const formatOptionalDateKey = (date: Date | null | undefined) =>
  date ? formatDateKey(date) : null;

const addDays = (date: Date, daysToAdd: number): Date => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  return nextDate;
};

const parseWeekday = (rawValue: unknown): number | null => {
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  return normalizedValue in WEEKDAY_INDEX ? WEEKDAY_INDEX[normalizedValue] : null;
};

const resolveDateRange = (payload: {
  startDate?: unknown;
  endDate?: unknown;
  startWeekday?: unknown;
  endWeekday?: unknown;
  anchorDate?: unknown;
}): { startDate: Date; endDate: Date } | { error: string } => {
  const hasDateKeys = payload.startDate !== undefined || payload.endDate !== undefined;
  const hasWeekdayKeys =
    payload.startWeekday !== undefined ||
    payload.endWeekday !== undefined ||
    payload.anchorDate !== undefined;

  if (hasDateKeys && hasWeekdayKeys) {
    return {
      error:
        "Provide either startDate/endDate or startWeekday/endWeekday with anchorDate, not both."
    };
  }

  if (hasDateKeys) {
    const parsedStartDate = parseDateKey(payload.startDate);
    const parsedEndDate = parseDateKey(payload.endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return { error: "Invalid date format. Expected YYYY-MM-DD." };
    }

    return {
      startDate: parsedStartDate,
      endDate: parsedEndDate
    };
  }

  const parsedAnchorDate = parseDateKey(payload.anchorDate);
  const parsedStartWeekday = parseWeekday(payload.startWeekday);
  const parsedEndWeekday = parseWeekday(payload.endWeekday);

  if (!parsedAnchorDate || parsedStartWeekday === null || parsedEndWeekday === null) {
    return {
      error:
        "When using weekdays, startWeekday, endWeekday, and anchorDate (YYYY-MM-DD) are required."
    };
  }

  const anchorWeekday = parsedAnchorDate.getUTCDay();
  const startOffset = (parsedStartWeekday - anchorWeekday + 7) % 7;
  const startDate = addDays(parsedAnchorDate, startOffset);
  const endOffset = (parsedEndWeekday - parsedStartWeekday + 7) % 7;
  const endDate = addDays(startDate, endOffset);

  return { startDate, endDate };
};

plansRouter.post("/api/plans", async (request, response) => {
  const { name, startDate, endDate, startWeekday, endWeekday, anchorDate } = request.body as {
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    startWeekday?: unknown;
    endWeekday?: unknown;
    anchorDate?: unknown;
  };

  const resolvedRange = resolveDateRange({
    startDate,
    endDate,
    startWeekday,
    endWeekday,
    anchorDate
  });

  if ("error" in resolvedRange) {
    response.status(400).json({ message: resolvedRange.error });
    return;
  }

  if (resolvedRange.endDate.getTime() < resolvedRange.startDate.getTime()) {
    response.status(400).json({ message: "endDate cannot be before startDate." });
    return;
  }

  const dateRange = buildDateRange(resolvedRange.startDate, resolvedRange.endDate);

  if (dateRange.length > MAX_PLAN_SPAN_DAYS) {
    response.status(400).json({
      message: `Plan range cannot exceed ${MAX_PLAN_SPAN_DAYS} days.`
    });
    return;
  }

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const planName =
    normalizedName ||
    `Plan ${formatDateKey(resolvedRange.startDate)} to ${formatDateKey(resolvedRange.endDate)}`;

  try {
    const { plan, days } = await createPlanWithDays({
      name: planName,
      startDate: resolvedRange.startDate,
      endDate: resolvedRange.endDate
    });

    response.status(201).json({
      plan: {
        id: plan.id,
        name: plan.name,
        isCurrent: plan.isCurrent,
        startDate: formatDateKey(plan.startDate ?? resolvedRange.startDate),
        endDate: formatDateKey(plan.endDate ?? resolvedRange.endDate)
      },
      days: days.map((day) => ({
        id: day.id,
        planId: day.planId,
        date: formatDateKey(day.date)
      }))
    });
  } catch (error: unknown) {
    if (error instanceof PlanValidationError) {
      response.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof PlanConflictError) {
      response.status(409).json({ message: error.message });
      return;
    }

    throw error;
  }
});

plansRouter.get("/api/plans", async (_request, response) => {
  const plans = await prisma.plan.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      isCurrent: true,
      startDate: true,
      endDate: true,
      _count: {
        select: {
          days: true
        }
      }
    }
  });

  response.status(200).json({
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isCurrent: plan.isCurrent,
      startDate: formatOptionalDateKey(plan.startDate),
      endDate: formatOptionalDateKey(plan.endDate),
      daysCount: plan._count.days
    }))
  });
});

plansRouter.get("/api/plans/:planId", async (request, response) => {
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      isCurrent: true,
      startDate: true,
      endDate: true,
      days: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          dinnerDish: {
            select: {
              id: true,
              name: true,
              notes: true
            }
          },
          breakfastDishes: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              name: true,
              notes: true,
              familyMemberId: true,
              familyMember: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          lunchDishes: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              name: true,
              notes: true,
              familyMemberId: true,
              familyMember: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!plan) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  response.status(200).json({
    plan: {
      id: plan.id,
      name: plan.name,
      isCurrent: plan.isCurrent,
      startDate: formatOptionalDateKey(plan.startDate),
      endDate: formatOptionalDateKey(plan.endDate),
      planDays: plan.days.map((day) => ({
        id: day.id,
        date: formatDateKey(day.date),
        dinnerDish: day.dinnerDish,
        breakfastDishes: day.breakfastDishes.map((breakfastDish) => ({
          id: breakfastDish.id,
          name: breakfastDish.name,
          notes: breakfastDish.notes,
          familyMemberId: breakfastDish.familyMemberId,
          familyMember: breakfastDish.familyMember
            ? {
                id: breakfastDish.familyMember.id,
                name: breakfastDish.familyMember.name
              }
            : null
        })),
        lunchDishes: day.lunchDishes.map((lunchDish) => ({
          id: lunchDish.id,
          name: lunchDish.name,
          notes: lunchDish.notes,
          familyMemberId: lunchDish.familyMemberId,
          familyMember: lunchDish.familyMember
            ? {
                id: lunchDish.familyMember.id,
                name: lunchDish.familyMember.name
              }
            : null
        }))
      }))
    }
  });
});

plansRouter.post("/api/plans/:planId/set-current", async (request, response) => {
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true
    }
  });

  if (!plan) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.plan.updateMany({
      data: {
        isCurrent: false
      }
    });

    await tx.plan.update({
      where: { id: planId },
      data: {
        isCurrent: true
      }
    });
  });

  response.status(200).json({
    message: "Current plan updated.",
    planId
  });
});

plansRouter.put("/api/plans/:planId", async (request, response) => {
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const { name, startDate, endDate } = request.body as {
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: "Plan name is required." });
    return;
  }

  const parsedStartDate = parseDateKey(startDate);
  const parsedEndDate = parseDateKey(endDate);

  if (!parsedStartDate || !parsedEndDate) {
    response.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD." });
    return;
  }

  const dateRange = buildDateRange(parsedStartDate, parsedEndDate);

  if (dateRange.length > MAX_PLAN_SPAN_DAYS) {
    response.status(400).json({
      message: `Plan range cannot exceed ${MAX_PLAN_SPAN_DAYS} days.`
    });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      days: {
        select: {
          id: true,
          date: true
        }
      }
    }
  });

  if (!plan) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  const normalizedDateRangeKeys = new Set(dateRange.map((date) => formatDateKey(date)));
  const daysToDelete = plan.days
    .filter((day) => !normalizedDateRangeKeys.has(formatDateKey(day.date)))
    .map((day) => day.id);
  const existingDayKeys = new Set(plan.days.map((day) => formatDateKey(day.date)));
  const daysToCreate = dateRange.filter((date) => !existingDayKeys.has(formatDateKey(date)));

  try {
    const updatedPlan = await prisma.$transaction(async (tx) => {
      if (daysToDelete.length > 0) {
        await tx.planDay.deleteMany({
          where: {
            id: {
              in: daysToDelete
            }
          }
        });
      }

      if (daysToCreate.length > 0) {
        await tx.planDay.createMany({
          data: daysToCreate.map((date) => ({
            planId,
            date
          }))
        });
      }

      return tx.plan.update({
        where: { id: planId },
        data: {
          name: normalizedName,
          startDate: parsedStartDate,
          endDate: parsedEndDate
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true
        }
      });
    });

    response.status(200).json({
      plan: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        startDate: formatOptionalDateKey(updatedPlan.startDate),
        endDate: formatOptionalDateKey(updatedPlan.endDate)
      }
    });
  } catch (error: unknown) {
    const isUniqueConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUniqueConflict) {
      response.status(409).json({ message: "A plan with this name already exists." });
      return;
    }

    throw error;
  }
});

plansRouter.delete("/api/plans/:planId", async (request, response) => {
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: "Invalid plan id." });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true
    }
  });

  if (!plan) {
    response.status(404).json({ message: "Plan not found." });
    return;
  }

  await prisma.plan.delete({
    where: { id: planId }
  });

  response.status(204).send();
});

export default plansRouter;
