import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

// Meal rows keep the order they were written in, which is the order the day
// card shows them in and the order a reader expects to read them back in.
const breakfastRowOrderBy: Prisma.BreakfastDishOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" }
];

const lunchRowOrderBy: Prisma.LunchDishOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" }
];

const mealRowSelect = {
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
} satisfies Prisma.BreakfastDishSelect & Prisma.LunchDishSelect;

/**
 * The single shape every endpoint returns a plan day's meals in, so the plan
 * detail response and the meal swap response can never drift apart.
 */
export const planDayMealsSelect = {
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
    orderBy: breakfastRowOrderBy,
    select: mealRowSelect
  },
  lunchDishes: {
    orderBy: lunchRowOrderBy,
    select: mealRowSelect
  }
} satisfies Prisma.PlanDaySelect;

export type PlanDayWithMeals = Prisma.PlanDayGetPayload<{
  select: typeof planDayMealsSelect;
}>;

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const mapMealRow = (mealRow: PlanDayWithMeals["breakfastDishes"][number]) => ({
  id: mealRow.id,
  name: mealRow.name,
  notes: mealRow.notes,
  familyMemberId: mealRow.familyMemberId,
  familyMember: mealRow.familyMember
    ? {
        id: mealRow.familyMember.id,
        name: mealRow.familyMember.name
      }
    : null
});

export const mapPlanDayMeals = (planDay: PlanDayWithMeals) => ({
  id: planDay.id,
  date: formatDateKey(planDay.date),
  dinnerDish: planDay.dinnerDish,
  breakfastDishes: planDay.breakfastDishes.map(mapMealRow),
  lunchDishes: planDay.lunchDishes.map(mapMealRow)
});

export const readPlanDayMeals = async (planDayIds: number[]) => {
  const planDays = await prisma.planDay.findMany({
    where: { id: { in: planDayIds } },
    orderBy: { date: "asc" },
    select: planDayMealsSelect
  });

  return planDays.map(mapPlanDayMeals);
};
