import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth, requireAuth } from "../middleware/auth";
import { getPlanPantryMatches } from "../services/pantry";
import { mapPlanDayMeals, planDayMealsSelect } from "../services/planDayMeals";
import {
  PlanConflictError,
  PlanValidationError,
  buildDateRange,
  createPlanWithDays,
  hasPlanEnded,
  parseIsoDayKey
} from "../services/plans";
import { requestLocale, translate, translatePlural } from "../i18n";

const plansRouter = Router();

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

plansRouter.post("/api/plans", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
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
    response.status(400).json({ message: translate(locale, "plans.endBeforeStart") });
    return;
  }

  const dateRange = buildDateRange(resolvedRange.startDate, resolvedRange.endDate);

  if (dateRange.length > MAX_PLAN_SPAN_DAYS) {
    response.status(400).json({
      message: translatePlural(locale, "plans.rangeTooLong", MAX_PLAN_SPAN_DAYS)
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

plansRouter.get("/api/plans", requireAuth, async (_request, response) => {
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
      daysCount: plan._count.days,
      hasEnded: hasPlanEnded(plan.endDate)
    }))
  });
});

plansRouter.get("/api/plans/:planId", requireAuth, async (request, response) => {
  const locale = requestLocale(request);
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: translate(locale, "plans.invalidId") });
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
        select: planDayMealsSelect
      }
    }
  });

  if (!plan) {
    response.status(404).json({ message: translate(locale, "plans.notFound") });
    return;
  }

  response.status(200).json({
    plan: {
      id: plan.id,
      name: plan.name,
      isCurrent: plan.isCurrent,
      startDate: formatOptionalDateKey(plan.startDate),
      endDate: formatOptionalDateKey(plan.endDate),
      hasEnded: hasPlanEnded(plan.endDate),
      planDays: plan.days.map(mapPlanDayMeals)
    }
  });
});

/**
 * What this plan could take out of the kitchen cabinets, so the plan screen can
 * say "you already have the corn" before anyone writes it on a shopping list.
 */
plansRouter.get("/api/plans/:planId/pantry-matches", requireAuth, async (request, response) => {
  const locale = requestLocale(request);
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: translate(locale, "plans.invalidId") });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true }
  });

  if (!plan) {
    response.status(404).json({ message: translate(locale, "plans.notFound") });
    return;
  }

  response.status(200).json({ matches: await getPlanPantryMatches(planId) });
});

plansRouter.post("/api/plans/:planId/set-current", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: translate(locale, "plans.invalidId") });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      isCurrent: true,
      endDate: true
    }
  });

  if (!plan) {
    response.status(404).json({ message: translate(locale, "plans.notFound") });
    return;
  }

  // A week that finished yesterday is not the week the family is eating, so it
  // cannot be picked as the current plan. The plan that already holds the flag
  // is exempt: it keeps it as its last day passes, rather than the household
  // being left with no current plan until someone makes a new one.
  if (!plan.isCurrent && hasPlanEnded(plan.endDate)) {
    response.status(409).json({ message: translate(locale, "plans.endedCannotBeCurrent") });
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
    message: translate(locale, "plans.currentPlanUpdated"),
    planId
  });
});

plansRouter.put("/api/plans/:planId", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: translate(locale, "plans.invalidId") });
    return;
  }

  const { name, startDate, endDate } = request.body as {
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedName) {
    response.status(400).json({ message: translate(locale, "plans.nameRequired") });
    return;
  }

  const parsedStartDate = parseDateKey(startDate);
  const parsedEndDate = parseDateKey(endDate);

  if (!parsedStartDate || !parsedEndDate) {
    response.status(400).json({ message: translate(locale, "plans.invalidDateFormat") });
    return;
  }

  const dateRange = buildDateRange(parsedStartDate, parsedEndDate);

  if (dateRange.length > MAX_PLAN_SPAN_DAYS) {
    response.status(400).json({
      message: translatePlural(locale, "plans.rangeTooLong", MAX_PLAN_SPAN_DAYS)
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
    response.status(404).json({ message: translate(locale, "plans.notFound") });
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
      response.status(409).json({ message: translate(locale, "plans.nameTaken") });
      return;
    }

    throw error;
  }
});

plansRouter.delete("/api/plans/:planId", requireAdminAuth, async (request, response) => {
  const locale = requestLocale(request);
  const planId = Number(request.params.planId);

  if (Number.isNaN(planId)) {
    response.status(400).json({ message: translate(locale, "plans.invalidId") });
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true
    }
  });

  if (!plan) {
    response.status(404).json({ message: translate(locale, "plans.notFound") });
    return;
  }

  await prisma.plan.delete({
    where: { id: planId }
  });

  response.status(204).send();
});

export default plansRouter;
