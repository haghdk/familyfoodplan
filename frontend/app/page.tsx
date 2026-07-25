import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChefHat,
  ClipboardList,
  PlusCircle,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed
} from "lucide-react";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../lib/auth";
import {
  formatDateRange,
  formatShortDate,
  formatWeekday,
  getTodayDayKey,
  toDayKey
} from "../lib/dates";
import CurrentPlanTable, {
  type CurrentPlanTableDayRow
} from "../components/plan/CurrentPlanTable";
import Badge from "../components/ui/Badge";
import { buttonClassName } from "../components/ui/Button";
import Card, { SectionCard } from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";

type PlanListItem = {
  id: number;
  name: string;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
  daysCount: number;
};

type PlanDay = {
  id: number;
  date: string;
  dinnerDish: {
    id: number;
    name: string;
  } | null;
  breakfastDishes?: Array<{
    id: number;
    name: string;
  }>;
  lunchDishes: Array<{
    id: number;
    name: string;
  }>;
};

type PlanDetailResponse = {
  plan: {
    id: number;
    planDays?: PlanDay[];
    days?: PlanDay[];
  };
};

const asDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const normalizeDate = (date: Date) => {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
};

const findCurrentPlan = (plans: PlanListItem[], today: Date) => {
  const explicitlyCurrentPlan = plans.find((plan) => plan.isCurrent);

  if (explicitlyCurrentPlan) {
    return explicitlyCurrentPlan;
  }

  const dateRangeMatchingPlan = plans.find((plan) => {
    const startDate = asDate(plan.startDate);
    const endDate = asDate(plan.endDate);

    if (!startDate || !endDate) {
      return false;
    }

    const normalizedStartDate = normalizeDate(startDate);
    const normalizedEndDate = normalizeDate(endDate);

    return normalizedStartDate <= today && today <= normalizedEndDate;
  });

  return dateRangeMatchingPlan ?? plans[0] ?? null;
};

const selectRecentPlans = (plans: PlanListItem[], today: Date) => {
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - 28);

  return plans
    .filter((plan) => {
      const startDate = asDate(plan.startDate);
      const endDate = asDate(plan.endDate);

      return (startDate && normalizeDate(startDate) >= cutoffDate)
        || (endDate && normalizeDate(endDate) >= cutoffDate);
    })
    .slice(0, 6);
};

const getSessionToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(adminSessionCookieName)?.value;
};

const getPlans = async (): Promise<PlanListItem[] | null> => {
  const sessionToken = await getSessionToken();

  try {
    const response = await fetch(`${backendApiUrl}/api/plans`, {
      headers: {
        ...(sessionToken
          ? { Cookie: `${adminSessionCookieName}=${sessionToken}` }
          : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { plans: PlanListItem[] };
    return data.plans;
  } catch (_error) {
    return null;
  }
};

const getPlanById = async (planId: number): Promise<PlanDetailResponse["plan"] | null> => {
  const sessionToken = await getSessionToken();

  try {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
      headers: {
        ...(sessionToken
          ? { Cookie: `${adminSessionCookieName}=${sessionToken}` }
          : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PlanDetailResponse;
    return data.plan;
  } catch (_error) {
    return null;
  }
};

const buildCurrentPlanTableRows = (
  planDays: PlanDay[],
  todayDayKey: string
): CurrentPlanTableDayRow[] => {
  return [...planDays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((planDay) => {
      const dayKey = toDayKey(planDay.date) ?? planDay.date;

      return {
        id: planDay.id,
        dayKey,
        weekdayLabel: formatWeekday(dayKey),
        dateLabel: formatShortDate(dayKey),
        isToday: dayKey === todayDayKey,
        breakfasts: (planDay.breakfastDishes ?? []).map((dish) => dish.name),
        lunches: planDay.lunchDishes.map((dish) => dish.name),
        dinners: planDay.dinnerDish ? [planDay.dinnerDish.name] : []
      };
    });
};

const countPlannedMeals = (dayRows: CurrentPlanTableDayRow[]) =>
  dayRows.reduce(
    (total, row) =>
      total + (row.breakfasts?.length ?? 0) + row.lunches.length + row.dinners.length,
    0
  );

export default async function HomePage() {
  const plans = await getPlans();
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get(userRoleCookieName)?.value === "ADMIN";

  if (!plans || plans.length === 0) {
    return (
      <section>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-brand-soft/60 px-6 py-10 sm:px-10 sm:py-14">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              <Sparkles className="h-4 w-4" />
              Weekly planning made simple
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
              Build your next family meal plan.
            </h1>
            <p className="mt-4 max-w-xl text-base text-fg-muted">
              We could not load plans right now, or you have not created one yet.
              Start by picking the days your week runs from and to.
            </p>
            {isAdmin ? (
              <Link className={buttonClassName({ size: "lg", className: "mt-7" })} href="/plan/new">
                <PlusCircle className="h-4 w-4" />
                Create a plan
              </Link>
            ) : null}
          </div>
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-10">
            {[
              {
                icon: <CalendarRange className="h-4 w-4" />,
                title: "Pick your week",
                description: "Any start and end weekday — Sunday to Saturday, or your own rhythm."
              },
              {
                icon: <UtensilsCrossed className="h-4 w-4" />,
                title: "Fill in the meals",
                description: "Breakfast, lunch and dinner per day, with per-member assignments."
              },
              {
                icon: <ShoppingCart className="h-4 w-4" />,
                title: "Share the shopping",
                description: "Turn the plan into a grocery list anyone can tick off live."
              }
            ].map((feature) => (
              <div className="flex gap-3" key={feature.title}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  {feature.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">{feature.title}</p>
                  <p className="mt-1 text-sm text-fg-muted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    );
  }

  const todayDayKey = getTodayDayKey();
  const today = normalizeDate(new Date());
  const currentPlan = findCurrentPlan(plans, today);
  const currentPlanDetails = currentPlan ? await getPlanById(currentPlan.id) : null;
  const currentPlanRows = currentPlanDetails
    ? buildCurrentPlanTableRows(
        currentPlanDetails.days ?? currentPlanDetails.planDays ?? [],
        todayDayKey
      )
    : [];
  const recentPlans = selectRecentPlans(plans, today).filter(
    (plan) => plan.id !== currentPlan?.id
  );
  const plannedMealsCount = countPlannedMeals(currentPlanRows);

  return (
    <section className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-5 border-b border-border bg-surface-muted/60 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              <CalendarDays className="h-4 w-4" />
              Current plan
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              {currentPlan?.name ?? "No active plan"}
            </h1>
            {currentPlan ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge icon={<CalendarRange className="h-3.5 w-3.5" />} tone="brand">
                  {formatDateRange(currentPlan.startDate, currentPlan.endDate)}
                </Badge>
                <Badge>{currentPlan.daysCount} days</Badge>
                <Badge icon={<ChefHat className="h-3.5 w-3.5" />}>
                  {plannedMealsCount} meals planned
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentPlan ? (
              <>
                <Link className={buttonClassName()} href={`/plan/${currentPlan.id}`}>
                  Open plan
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  className={buttonClassName({ variant: "secondary" })}
                  href={`/plan/${currentPlan.id}/grocery-list`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Grocery list
                </Link>
              </>
            ) : null}
            {isAdmin ? (
              <Link
                className={buttonClassName({
                  variant: currentPlan ? "secondary" : "primary"
                })}
                href="/plan/new"
              >
                <PlusCircle className="h-4 w-4" />
                New plan
              </Link>
            ) : null}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {currentPlan ? (
            <CurrentPlanTable dayRows={currentPlanRows} />
          ) : (
            <EmptyState
              description="Mark one of your plans as the current plan to see it here."
              icon={<CalendarDays className="h-5 w-5" />}
              title="No plan is set as current"
            />
          )}
        </div>
      </Card>

      <SectionCard
        actions={
          <Link className={buttonClassName({ variant: "secondary" })} href="/plan">
            <CalendarDays className="h-4 w-4" />
            View all plans
          </Link>
        }
        description="Quickly reopen weekly plans from the last four weeks."
        icon={<ClipboardList className="h-4 w-4" />}
        title="Recent plans"
      >
        {recentPlans.length === 0 ? (
          <EmptyState
            description="Plans you create will show up here for four weeks."
            icon={<ClipboardList className="h-5 w-5" />}
            title="No other recent plans"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recentPlans.map((plan) => (
              <li
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted/40 p-4 transition hover:border-brand-border"
                key={plan.id}
              >
                <div>
                  <p className="font-semibold text-fg">{plan.name}</p>
                  <p className="mt-1 text-sm text-fg-muted">
                    {formatDateRange(plan.startDate, plan.endDate)}
                    <span className="mx-1.5 text-fg-subtle">•</span>
                    {plan.daysCount} days
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={buttonClassName({ size: "sm" })}
                    href={`/plan/${plan.id}`}
                  >
                    Open plan
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    className={buttonClassName({ size: "sm", variant: "secondary" })}
                    href={`/plan/${plan.id}/grocery-list`}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Grocery list
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </section>
  );
}
