import { prisma } from "../lib/prisma";

const ISO_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class PlanValidationError extends Error {
  readonly code = "PLAN_VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

export class PlanNotFoundError extends Error {
  readonly code = "PLAN_NOT_FOUND_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "PlanNotFoundError";
  }
}

export class PlanConflictError extends Error {
  readonly code = "PLAN_CONFLICT_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "PlanConflictError";
  }
}

export const parseIsoDayKey = (input: string): Date | null => {
  const normalizedValue = input.trim();

  if (!ISO_DAY_KEY_REGEX.test(normalizedValue)) {
    return null;
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10) === normalizedValue ? parsedDate : null;
};

const addDays = (date: Date, daysToAdd: number): Date => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  return nextDate;
};

export const buildDateRange = (start: Date, end: Date): Date[] => {
  if (end.getTime() < start.getTime()) {
    throw new PlanValidationError("endDate cannot be before startDate.");
  }

  const dates: Date[] = [];
  let cursorDate = new Date(start);

  while (cursorDate.getTime() <= end.getTime()) {
    dates.push(new Date(cursorDate));
    cursorDate = addDays(cursorDate, 1);
  }

  return dates;
};

type CreatePlanWithDaysParams = {
  name: string;
  startDate: Date;
  endDate: Date;
};

export const createPlanWithDays = async (
  params: CreatePlanWithDaysParams
): Promise<{
  plan: {
    id: number;
    name: string;
    isCurrent: boolean;
    startDate: Date | null;
    endDate: Date | null;
  };
  days: Array<{ id: number; date: Date; planId: number }>;
}> => {
  const normalizedName = params.name.trim();

  if (!normalizedName) {
    throw new PlanValidationError("Plan name is required.");
  }

  const dateRange = buildDateRange(params.startDate, params.endDate);

  try {
    return await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.plan.create({
        data: {
          name: normalizedName,
          startDate: params.startDate,
          endDate: params.endDate
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

      return {
        plan: {
          id: createdPlan.id,
          name: createdPlan.name,
          isCurrent: createdPlan.isCurrent,
          startDate: createdPlan.startDate,
          endDate: createdPlan.endDate
        },
        days: createdDays
      };
    });
  } catch (error: unknown) {
    const isUniqueConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUniqueConflict) {
      throw new PlanConflictError("A plan with this name already exists.");
    }

    throw error;
  }
};
