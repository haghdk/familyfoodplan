import { Router } from "express";
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

export default plansRouter;
