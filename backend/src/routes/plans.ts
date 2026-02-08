import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";

const plansRouter = Router();

plansRouter.use(requireAdminAuth);

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
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

  const normalizedValue = rawValue.trim();

  if (!DATE_KEY_REGEX.test(normalizedValue)) {
    return null;
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10) === normalizedValue ? parsedDate : null;
};

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, daysToAdd: number): Date => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  return nextDate;
};

const buildDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  let cursorDate = new Date(startDate);

  while (cursorDate.getTime() <= endDate.getTime()) {
    dates.push(new Date(cursorDate));
    cursorDate = addDays(cursorDate, 1);
  }

  return dates;
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
    const { plan, days } = await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.plan.create({
        data: {
          name: planName,
          startDate: resolvedRange.startDate,
          endDate: resolvedRange.endDate
        }
      });

      const createdDays = [] as Array<{ id: number; date: Date; planId: number }>;

      for (const date of dateRange) {
        const createdDay = await tx.planDay.create({
          data: {
            planId: createdPlan.id,
            date
          },
          select: {
            id: true,
            planId: true,
            date: true
          }
        });

        createdDays.push(createdDay);
      }

      return { plan: createdPlan, days: createdDays };
    });

    response.status(201).json({
      plan: {
        id: plan.id,
        name: plan.name,
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
    const isKnownPrismaError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isKnownPrismaError) {
      response.status(409).json({ message: "A plan with this name already exists." });
      return;
    }

    throw error;
  }
});

export default plansRouter;
