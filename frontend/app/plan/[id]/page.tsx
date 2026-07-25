import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  CalendarRange,
  Croissant,
  Sandwich,
  ShoppingCart,
  UtensilsCrossed
} from "lucide-react";
import { adminSessionCookieName, backendApiUrl, userRoleCookieName } from "../../../lib/auth";
import { formatDateRange, formatDayLabel, getTodayDayKey, toDayKey } from "../../../lib/dates";
import PlanDayCard from "../../../components/plan/PlanDayCard";
import PlanSettingsForm from "../../../components/plan/PlanSettingsForm";
import SetCurrentPlanButton from "../../../components/plan/SetCurrentPlanButton";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
import { buttonClassName } from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import PageHeader from "../../../components/ui/PageHeader";

type PlanDetailResponse = {
  plan: {
    id: number;
    name: string;
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
    planDays: Array<{
      id: number;
      date: string;
      dinnerDish: {
        id: number;
        name: string;
        notes: string | null;
      } | null;
      breakfastDishes: Array<{
        id: number;
        name: string;
        notes: string | null;
        familyMemberId: number | null;
      }>;
      lunchDishes: Array<{
        id: number;
        name: string;
        notes: string | null;
        familyMemberId: number | null;
      }>;
    }>;
  };
};

const getPlan = async (planId: string): Promise<PlanDetailResponse["plan"] | null> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/plans/${planId}`, {
      headers: {
        ...(sessionToken ? { Cookie: `${adminSessionCookieName}=${sessionToken}` } : {})
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

export default async function PlanPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlan(id);
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get(userRoleCookieName)?.value === "ADMIN";

  if (!plan) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <Alert tone="error">Could not load this plan.</Alert>
        <Link className={buttonClassName({ variant: "secondary" })} href="/plan">
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </Link>
      </section>
    );
  }

  const todayDayKey = getTodayDayKey();

  return (
    <section className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-brand"
          href="/plan"
        >
          <ArrowLeft className="h-4 w-4" />
          All plans
        </Link>
      </div>

      <PageHeader
        actions={
          <>
            {isAdmin ? (
              <SetCurrentPlanButton
                idleLabel="Set as current"
                isCurrent={plan.isCurrent}
                planId={plan.id}
              />
            ) : null}
            <Link
              className={buttonClassName()}
              href={`/plan/${plan.id}/grocery-list`}
            >
              <ShoppingCart className="h-4 w-4" />
              Grocery list
            </Link>
          </>
        }
        description={`${plan.planDays.length} day${plan.planDays.length === 1 ? "" : "s"} in this plan.`}
        title={plan.name}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge icon={<CalendarRange className="h-3.5 w-3.5" />} tone="brand">
          {formatDateRange(plan.startDate, plan.endDate)}
        </Badge>
        {plan.isCurrent ? <Badge tone="accent">Current plan</Badge> : null}
      </div>

      {isAdmin ? (
        <>
          <PlanSettingsForm
            initialEndDate={toDayKey(plan.endDate)}
            initialName={plan.name}
            initialStartDate={toDayKey(plan.startDate)}
            planId={plan.id}
          />

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {plan.planDays.map((planDay) => {
              const dayKey = toDayKey(planDay.date) ?? planDay.date;

              return (
                <PlanDayCard
                  dayKey={dayKey}
                  dayLabel={formatDayLabel(dayKey)}
                  initialBreakfastes={planDay.breakfastDishes}
                  initialDinner={planDay.dinnerDish}
                  initialLunches={planDay.lunchDishes}
                  isToday={dayKey === todayDayKey}
                  key={planDay.id}
                  planId={plan.id}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plan.planDays.map((planDay) => {
            const dayKey = toDayKey(planDay.date) ?? planDay.date;
            const isToday = dayKey === todayDayKey;
            const meals = [
              {
                label: "Breakfast",
                icon: <Croissant className="h-4 w-4" />,
                iconClassName: "bg-breakfast-soft text-breakfast",
                value: planDay.breakfastDishes.map((dish) => dish.name).join(", ")
              },
              {
                label: "Lunch",
                icon: <Sandwich className="h-4 w-4" />,
                iconClassName: "bg-lunch-soft text-lunch",
                value: planDay.lunchDishes.map((dish) => dish.name).join(", ")
              },
              {
                label: "Dinner",
                icon: <UtensilsCrossed className="h-4 w-4" />,
                iconClassName: "bg-dinner-soft text-dinner",
                value: planDay.dinnerDish?.name ?? ""
              }
            ];

            return (
              <Card
                className={isToday ? "border-brand-border ring-1 ring-brand/20" : undefined}
                key={planDay.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-fg">
                    {formatDayLabel(dayKey)}
                  </h2>
                  {isToday ? <Badge tone="brand">Today</Badge> : null}
                </div>

                <dl className="mt-4 space-y-3">
                  {meals.map((meal) => (
                    <div className="flex items-start gap-3" key={meal.label}>
                      <dt
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${meal.iconClassName}`}
                      >
                        {meal.icon}
                        <span className="sr-only">{meal.label}</span>
                      </dt>
                      <dd className="min-w-0 flex-1 text-sm">
                        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                          {meal.label}
                        </span>
                        <span
                          className={`mt-0.5 block ${meal.value ? "text-fg" : "text-fg-subtle"}`}
                        >
                          {meal.value || "Not planned"}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
